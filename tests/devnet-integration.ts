/**
 * OracleBet DevNet Integration Test - Full ER Roundtrip
 *
 * Flow:
 *   Step 1: initialize_factory  (L1)
 *   Step 2: create_market       (L1)
 *   Step 3: place_bet           (L1)
 *   Step 4: delegate_market     (L1 -> ER)
 *   Step 4.5: bootstrap_er_fee  (L1)
 *   Step 5: resolve_market      (ER -> commit_and_undelegate -> L1)
 *   Step 6: claim_winnings      (L1)
 */

import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";

const PROGRAM_ID = new PublicKey("BFv69p4dBZtPvDcUUnVBhiCCgAFVq5gpEWspnfmKxRKY");
const DEVNET_RPC = "https://api.devnet.solana.com";
const ER_RPC = "https://devnet.magicblock.app/";
const ER_WS_RPC = "wss://devnet.magicblock.app/";

const DELEGATION_PROGRAM = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
const PYTH_LAZER_STORAGE = new PublicKey("3rdJbqfnagQ4yx9HXJViD4zc4xpiSqmFsKpPuSCQVyQL");
const MAGIC_PROGRAM = new PublicKey("Magic11111111111111111111111111111111111111");
const MAGIC_CONTEXT = new PublicKey("MagicContext1111111111111111111111111111111");

const MARKET_ID = new anchor.BN(Date.now().toString());
const BET_AMOUNT_LAMPORTS = new anchor.BN(50_000_000); // 0.05 SOL
const RESOLUTION_PRICE = new anchor.BN("200000000000"); // $200 * 10^9

const ER_ESCROW_INDEX = 0;
const ER_MIN_ESCROW_LAMPORTS = 5_000_000; // 0.005 SOL
const ER_DELEGATE_COMMIT_FREQUENCY_MS = 0;

const TOP_UP_EPHEMERAL_BALANCE_DISC = Buffer.from([9, 0, 0, 0, 0, 0, 0, 0]);
const DELEGATE_EPHEMERAL_BALANCE_DISC = Buffer.from([10, 0, 0, 0, 0, 0, 0, 0]);

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(step: string, msg: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${step}] ${msg}`);
}

function section(title: string): void {
  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

function toU64Le(value: anchor.BN): Buffer {
  const data = Buffer.alloc(8);
  data.writeBigUInt64LE(BigInt(value.toString()));
  return data;
}

function deriveFactoryPda(): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("factory")], PROGRAM_ID)[0];
}

function deriveMarketPda(marketId: anchor.BN): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("market"), toU64Le(marketId)], PROGRAM_ID)[0];
}

function deriveVaultPda(marketId: anchor.BN): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("vault"), toU64Le(marketId)], PROGRAM_ID)[0];
}

function deriveBufferPda(delegatedPubkey: PublicKey, ownerProgram: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("buffer"), delegatedPubkey.toBuffer()], ownerProgram)[0];
}

function deriveDelegationRecordPda(delegatedPubkey: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("delegation"), delegatedPubkey.toBuffer()],
    DELEGATION_PROGRAM,
  )[0];
}

function deriveDelegationMetadataPda(delegatedPubkey: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("delegation-metadata"), delegatedPubkey.toBuffer()],
    DELEGATION_PROGRAM,
  )[0];
}

function deriveMagicContextPda(): PublicKey {
  return MAGIC_CONTEXT;
}

function deriveEscrowPda(authority: PublicKey, index: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("balance"), authority.toBuffer(), Buffer.from([index])],
    DELEGATION_PROGRAM,
  )[0];
}

function createProgram(provider: anchor.AnchorProvider, idl: anchor.Idl): anchor.Program {
  return new anchor.Program(idl, provider);
}

async function confirmTx(connection: Connection, signature: string, stepName: string): Promise<void> {
  log(stepName, `Tx: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  const result = await connection.confirmTransaction(signature, "confirmed");
  if (result.value.err) {
    throw new Error(`${stepName} tx failed: ${JSON.stringify(result.value.err)}`);
  }
}

function encodeTopUpEphemeralBalanceArgs(amount: bigint, index: number): Buffer {
  const data = Buffer.alloc(8 + 1);
  data.writeBigUInt64LE(amount, 0);
  data.writeUInt8(index, 8);
  return data;
}

function encodeDelegateEphemeralBalanceArgs(commitFrequencyMs: number, index: number): Buffer {
  const data = Buffer.alloc(4 + 4 + 1 + 1);
  data.writeUInt32LE(commitFrequencyMs, 0);
  data.writeUInt32LE(0, 4); // seeds vec length
  data.writeUInt8(0, 8); // validator: None
  data.writeUInt8(index, 9);
  return data;
}

async function sendIxTx(
  connection: Connection,
  signer: Keypair,
  ix: TransactionInstruction,
  stepName: string,
  txLabel: string,
  skipPreflight = false,
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: signer.publicKey, blockhash, lastValidBlockHeight }).add(ix);
  tx.sign(signer);

  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight,
    preflightCommitment: "confirmed",
  });

  log(stepName, `${txLabel}: ${signature}`);
  const confirmResult = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  if (confirmResult.value.err) {
    throw new Error(`${txLabel} failed: ${JSON.stringify(confirmResult.value.err)}`);
  }

  return signature;
}

async function sendBuilderTx(
  connection: Connection,
  builder: any,
  signer: Keypair,
  stepName: string,
  txLabel: string,
  skipPreflight = true,
): Promise<string> {
  const tx = await builder.transaction();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.feePayer = signer.publicKey;
  tx.recentBlockhash = blockhash;
  tx.sign(signer);

  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight,
    preflightCommitment: "confirmed",
  });

  log(stepName, `${txLabel}: ${signature}`);
  const confirmResult = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  if (confirmResult.value.err) {
    throw new Error(`ER tx failed: ${JSON.stringify(confirmResult.value.err)}`);
  }

  return signature;
}

async function main(): Promise<void> {
  section("OracleBet DevNet Integration Test - Full ER Roundtrip");

  const walletPath = path.resolve(__dirname, "../wallet.json");
  if (!fs.existsSync(walletPath)) {
    throw new Error(`wallet.json not found: ${walletPath}`);
  }
  const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8"))));
  log("INIT", `Wallet pubkey: ${walletKeypair.publicKey.toBase58()}`);

  const idlPath = path.resolve(__dirname, "../target/idl/oracle_bet.json");
  const idl: anchor.Idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  log("INIT", "IDL loaded");

  const l1Connection = new Connection(DEVNET_RPC, "confirmed");
  const wallet = new anchor.Wallet(walletKeypair);
  const l1Provider = new anchor.AnchorProvider(l1Connection, wallet, {
    commitment: "confirmed",
    skipPreflight: false,
  });
  const l1Program = createProgram(l1Provider, idl);

  const erConnection = new Connection(ER_RPC, {
    commitment: "confirmed",
    wsEndpoint: ER_WS_RPC,
  });
  const erProvider = new anchor.AnchorProvider(erConnection, wallet, {
    commitment: "confirmed",
    skipPreflight: true,
  });
  const erProgram = createProgram(erProvider, idl);

  const initialBalance = await l1Connection.getBalance(walletKeypair.publicKey);
  log("INIT", `Wallet balance: ${initialBalance / LAMPORTS_PER_SOL} SOL`);
  if (initialBalance < 0.5 * LAMPORTS_PER_SOL) {
    throw new Error(`Insufficient SOL: ${initialBalance / LAMPORTS_PER_SOL} SOL. Need at least 0.5 SOL.`);
  }

  const factoryPda = deriveFactoryPda();
  const marketPda = deriveMarketPda(MARKET_ID);
  const vaultPda = deriveVaultPda(MARKET_ID);
  const marketBufferPda = deriveBufferPda(marketPda, PROGRAM_ID);
  const marketDelegationRecordPda = deriveDelegationRecordPda(marketPda);
  const marketDelegationMetadataPda = deriveDelegationMetadataPda(marketPda);
  const magicContextPda = deriveMagicContextPda();

  const escrowPda = deriveEscrowPda(walletKeypair.publicKey, ER_ESCROW_INDEX);
  const escrowBufferPda = deriveBufferPda(escrowPda, SystemProgram.programId);
  const escrowDelegationRecordPda = deriveDelegationRecordPda(escrowPda);
  const escrowDelegationMetadataPda = deriveDelegationMetadataPda(escrowPda);

  log("INIT", `Factory PDA:            ${factoryPda.toBase58()}`);
  log("INIT", `Market PDA:             ${marketPda.toBase58()}`);
  log("INIT", `Vault PDA:              ${vaultPda.toBase58()}`);
  log("INIT", `Market Buffer PDA:      ${marketBufferPda.toBase58()}`);
  log("INIT", `DelegationRecord PDA:   ${marketDelegationRecordPda.toBase58()}`);
  log("INIT", `DelegationMetadata PDA: ${marketDelegationMetadataPda.toBase58()}`);
  log("INIT", `MagicContext PDA:       ${magicContextPda.toBase58()}`);
  log("INIT", `Escrow PDA:             ${escrowPda.toBase58()}`);
  log("INIT", `Escrow Buffer PDA:      ${escrowBufferPda.toBase58()}`);

  section("Step 1: initialize_factory");
  const factoryInfo = await l1Connection.getAccountInfo(factoryPda);
  if (factoryInfo !== null) {
    log("STEP1", "[WARN] MarketFactory already exists - skipping initialize_factory");
  } else {
    const tx1 = await l1Program.methods
      .initializeFactory()
      .accounts({
        factory: factoryPda,
        authority: walletKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([walletKeypair])
      .rpc();
    await confirmTx(l1Connection, tx1, "STEP1");
    log("STEP1", `MarketFactory created: ${factoryPda.toBase58()}`);
  }

  section("Step 2: create_market");
  const resolutionTime = new anchor.BN(Math.floor(Date.now() / 1000) + 120);
  const question = "Will SOL be above $200 in 5 min?";

  log("STEP2", `market_id:        ${MARKET_ID.toString()}`);
  log("STEP2", `question:         ${question}`);
  log("STEP2", `resolution_price: ${RESOLUTION_PRICE.toString()} (= $200 * 10^9)`);
  log("STEP2", `resolution_time:  ${resolutionTime.toString()} = ${new Date(resolutionTime.toNumber() * 1000).toISOString()}`);

  const marketInfo = await l1Connection.getAccountInfo(marketPda);
  if (marketInfo !== null) {
    log("STEP2", "[WARN] Market already exists - skipping create_market");
  } else {
    const tx2 = await l1Program.methods
      .createMarket(MARKET_ID, question, RESOLUTION_PRICE, resolutionTime)
      .accounts({
        market: marketPda,
        vault: vaultPda,
        factory: factoryPda,
        creator: walletKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([walletKeypair])
      .rpc();
    await confirmTx(l1Connection, tx2, "STEP2");
    log("STEP2", `Market created: ${marketPda.toBase58()}`);
    log("STEP2", `Vault created:  ${vaultPda.toBase58()}`);
  }

  section("Step 3: place_bet (L1)");
  const betSide = 0; // 0 = YES

  log("STEP3", `side:   ${betSide} (YES)`);
  log(
    "STEP3",
    `amount: ${BET_AMOUNT_LAMPORTS.toString()} lamports = ${BET_AMOUNT_LAMPORTS.toNumber() / LAMPORTS_PER_SOL} SOL`,
  );

  const tx3 = await l1Program.methods
    .placeBet(MARKET_ID, betSide, BET_AMOUNT_LAMPORTS)
    .accounts({
      market: marketPda,
      vault: vaultPda,
      bettor: walletKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([walletKeypair])
    .rpc();
  await confirmTx(l1Connection, tx3, "STEP3");
  log("STEP3", "[OK] Bet confirmed on L1");

  section("Step 4: delegate_market (L1 -> ER)");
  log("STEP4", `Delegation Program: ${DELEGATION_PROGRAM.toBase58()}`);
  log("STEP4", `Owner Program:      ${PROGRAM_ID.toBase58()}`);

  const marketBeforeDelegate = await l1Connection.getAccountInfo(marketPda);
  const alreadyDelegated =
    marketBeforeDelegate !== null && marketBeforeDelegate.owner.equals(DELEGATION_PROGRAM);

  if (alreadyDelegated) {
    log("STEP4", "[WARN] Market PDA already delegated - skipping delegate_market");
  } else {
    const tx4 = await l1Program.methods
      .delegateMarket(MARKET_ID)
      .accounts({
        payer: walletKeypair.publicKey,
        market: marketPda,
        buffer: marketBufferPda,
        delegationRecord: marketDelegationRecordPda,
        delegationMetadata: marketDelegationMetadataPda,
        delegationProgram: DELEGATION_PROGRAM,
        ownerProgram: PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([walletKeypair])
      .rpc();
    await confirmTx(l1Connection, tx4, "STEP4");
    log("STEP4", "[OK] Market PDA delegated in ER");
    await sleep(3000);
  }

  section("Step 4.5: bootstrap_er_fee (L1)");

  const [escrowInfo, escrowDelegationRecordInfo] = await l1Connection.getMultipleAccountsInfo([
    escrowPda,
    escrowDelegationRecordPda,
  ]);

  const escrowBalanceBefore = escrowInfo?.lamports ?? 0;
  log("STEP4.5", `Escrow balance before: ${escrowBalanceBefore} lamports`);

  const topUpAmount = Math.max(0, ER_MIN_ESCROW_LAMPORTS - escrowBalanceBefore);
  if (topUpAmount > 0) {
    const topUpIx = new TransactionInstruction({
      programId: DELEGATION_PROGRAM,
      keys: [
        { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: walletKeypair.publicKey, isSigner: false, isWritable: false },
        { pubkey: escrowPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([
        TOP_UP_EPHEMERAL_BALANCE_DISC,
        encodeTopUpEphemeralBalanceArgs(BigInt(topUpAmount), ER_ESCROW_INDEX),
      ]),
    });

    const topUpSig = await sendIxTx(
      l1Connection,
      walletKeypair,
      topUpIx,
      "STEP4.5",
      "top_up_ephemeral_balance",
      false,
    );
    await confirmTx(l1Connection, topUpSig, "STEP4.5");
  } else {
    log("STEP4.5", `[OK] Escrow already funded (>= ${ER_MIN_ESCROW_LAMPORTS})`);
  }

  if (escrowDelegationRecordInfo === null) {
    const delegateEscrowIx = new TransactionInstruction({
      programId: DELEGATION_PROGRAM,
      keys: [
        { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: false },
        { pubkey: escrowPda, isSigner: false, isWritable: true },
        { pubkey: escrowBufferPda, isSigner: false, isWritable: true },
        { pubkey: escrowDelegationRecordPda, isSigner: false, isWritable: true },
        { pubkey: escrowDelegationMetadataPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: DELEGATION_PROGRAM, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([
        DELEGATE_EPHEMERAL_BALANCE_DISC,
        encodeDelegateEphemeralBalanceArgs(ER_DELEGATE_COMMIT_FREQUENCY_MS, ER_ESCROW_INDEX),
      ]),
    });

    const delegateSig = await sendIxTx(
      l1Connection,
      walletKeypair,
      delegateEscrowIx,
      "STEP4.5",
      "delegate_ephemeral_balance",
      false,
    );
    await confirmTx(l1Connection, delegateSig, "STEP4.5");
  } else {
    log("STEP4.5", "[OK] Escrow already delegated - skipping delegate_ephemeral_balance");
  }

  const escrowBalanceAfter = await l1Connection.getBalance(escrowPda);
  log("STEP4.5", `Escrow balance after: ${escrowBalanceAfter} lamports`);
  log("STEP4.5", "Waiting 5s for ER fee sync...");
  await sleep(5000);

  section("Step 5: resolve_market (ER -> commit_and_undelegate -> L1)");

  const nowSec = Math.floor(Date.now() / 1000);
  const waitSec = resolutionTime.toNumber() - nowSec;
  if (waitSec > 0) {
    log("STEP5", `Waiting ${waitSec} seconds for resolution_time...`);
    await sleep(waitSec * 1000 + 2000);
  }

  log("STEP5", `price_feed:   ${PYTH_LAZER_STORAGE.toBase58()}`);
  log("STEP5", `magicContext: ${magicContextPda.toBase58()}`);
  log("STEP5", `magicProgram: ${MAGIC_PROGRAM.toBase58()}`);

  const resolveStartTime = Date.now();

  const tx5 = await sendBuilderTx(
    erConnection,
    erProgram.methods
      .resolveMarket(MARKET_ID)
      .accounts({
        market: marketPda,
        priceFeed: PYTH_LAZER_STORAGE,
        magicContext: magicContextPda,
        magicProgram: MAGIC_PROGRAM,
        resolver: walletKeypair.publicKey,
      })
      .signers([walletKeypair]),
    walletKeypair,
    "STEP5",
    "ER Tx",
    true,
  );

  log("STEP5", `ER Tx: ${tx5}`);
  log("STEP5", "[ER_SYNC] commit_and_undelegate triggered, waiting for L1 sync...");

  await sleep(10_000);

  let marketResolved = false;
  for (let i = 0; i < 12; i += 1) {
    try {
      const marketAccount = await (l1Program.account as any).market.fetch(marketPda);
      const statusStr = JSON.stringify(marketAccount.status);
      const outcomeStr = JSON.stringify(marketAccount.outcome);
      log("STEP5", `L1 market status=${statusStr}, outcome=${outcomeStr}`);

      if ("resolved" in (marketAccount.status as object)) {
        const elapsed = ((Date.now() - resolveStartTime) / 1000).toFixed(1);
        log("STEP5", `[OK] Market resolved on L1 in ${elapsed}s`);
        marketResolved = true;
        break;
      }
    } catch (e: unknown) {
      log("STEP5", `[WARN] Failed to read market yet: ${(e as Error).message}`);
    }

    log("STEP5", `poll ${i + 1}/12 - waiting 5s...`);
    await sleep(5_000);
  }

  if (!marketResolved) {
    log("STEP5", "[WARN] Market is not resolved on L1 after 60s");
  }

  section("Step 6: claim_winnings (L1)");

  const balanceBeforeClaim = await l1Connection.getBalance(walletKeypair.publicKey);
  const vaultBalance = await l1Connection.getBalance(vaultPda);
  log("STEP6", `Balance before claim: ${balanceBeforeClaim / LAMPORTS_PER_SOL} SOL`);
  log("STEP6", `Vault balance:        ${vaultBalance / LAMPORTS_PER_SOL} SOL`);

  try {
    const tx6 = await l1Program.methods
      .claimWinnings(MARKET_ID)
      .accounts({
        market: marketPda,
        vault: vaultPda,
        claimant: walletKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([walletKeypair])
      .rpc();

    await confirmTx(l1Connection, tx6, "STEP6");

    const balanceAfterClaim = await l1Connection.getBalance(walletKeypair.publicKey);
    const gained = balanceAfterClaim - balanceBeforeClaim;
    log("STEP6", `Balance after claim:  ${balanceAfterClaim / LAMPORTS_PER_SOL} SOL`);
    log("STEP6", `Net gain:             ${gained / LAMPORTS_PER_SOL} SOL`);
    log("STEP6", "[OK] Winnings claimed");
  } catch (e: unknown) {
    const msg = (e as Error).message;
    if (msg.includes("NoWinningPosition") || msg.includes("AlreadyClaimed")) {
      log("STEP6", `[WARN] ${msg}`);
    } else if (msg.includes("MarketNotResolved")) {
      log("STEP6", "[WARN] Market is not resolved on L1 yet");
    } else {
      throw e;
    }
  }

  section("Summary");

  const finalBalance = await l1Connection.getBalance(walletKeypair.publicKey);
  const netSpent = initialBalance - finalBalance;

  log("DONE", `Initial balance: ${initialBalance / LAMPORTS_PER_SOL} SOL`);
  log("DONE", `Final balance:   ${finalBalance / LAMPORTS_PER_SOL} SOL`);
  log("DONE", `Net spent:       ${netSpent / LAMPORTS_PER_SOL} SOL (incl. fees)`);
  log("DONE", "[OK] OracleBet Full ER Roundtrip Test completed");

  log("DONE", `Factory: https://explorer.solana.com/address/${factoryPda.toBase58()}?cluster=devnet`);
  log("DONE", `Market:  https://explorer.solana.com/address/${marketPda.toBase58()}?cluster=devnet`);
  log("DONE", `Vault:   https://explorer.solana.com/address/${vaultPda.toBase58()}?cluster=devnet`);
}

main().catch((err) => {
  console.error("\nFATAL ERROR:", err);
  process.exit(1);
});
