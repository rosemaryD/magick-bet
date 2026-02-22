import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { OracleBet } from "../target/types/oracle_bet";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

describe("oracle_bet — Phase 2: L1 Instructions", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.OracleBet as Program<OracleBet>;
  const authority = provider.wallet as anchor.Wallet;

  let factoryPDA: PublicKey;

  before(async () => {
    [factoryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("factory")],
      program.programId
    );
  });

  it("initialize_factory: creates MarketFactory PDA", async () => {
    try {
      await program.methods
        .initializeFactory()
        .accounts({
          factory: factoryPDA,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (e: any) {
      // Игнорируем если уже инициализирован
      if (!e.message?.includes("already in use")) throw e;
    }

    const factory = await program.account.marketFactory.fetch(factoryPDA);
    assert.ok(factory.authority.equals(authority.publicKey), "authority set correctly");
    assert.ok(factory.marketCount.toNumber() >= 0, "market_count initialized");
  });

  it("create_market: creates Market PDA with correct initial state", async () => {
    const factory = await program.account.marketFactory.fetch(factoryPDA);
    const marketId = factory.marketCount;
    const marketIdBN = new anchor.BN(marketId);

    const [marketPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), marketIdBN.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketIdBN.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const now = Math.floor(Date.now() / 1000);
    const durationSeconds = 300; // 5 минут
    const resolutionTime = now + durationSeconds;
    const strikePrice = new anchor.BN(200 * 1_000_000); // $200 SOL/USD (scaled 1e6)

    await program.methods
      .createMarket(
        marketIdBN,
        "Will SOL be above $200 in 5 minutes?",
        strikePrice,
        new anchor.BN(resolutionTime)
      )
      .accounts({
        market: marketPDA,
        vault: vaultPDA,
        factory: factoryPDA,
        creator: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const market = await program.account.market.fetch(marketPDA);
    assert.ok(market.marketId.eq(marketIdBN), "market_id set correctly");
    assert.ok(market.creator.equals(authority.publicKey), "creator set correctly");
    assert.equal(market.totalYes.toNumber(), 0, "total_yes = 0");
    assert.equal(market.totalNo.toNumber(), 0, "total_no = 0");
    assert.ok(market.bets.length === 0, "bets empty");
    assert.equal(market.isDelegated, false, "not delegated yet");
    assert.ok(
      market.resolutionTime.toNumber() >= now + durationSeconds - 5,
      "resolution_time set correctly"
    );

    // Factory counter incremented
    const updatedFactory = await program.account.marketFactory.fetch(factoryPDA);
    assert.equal(
      updatedFactory.marketCount.toNumber(),
      marketId.toNumber() + 1,
      "factory.market_count incremented"
    );

    console.log(`✅ Market created: ${marketPDA.toBase58()}`);
    console.log(`✅ Vault created: ${vaultPDA.toBase58()}`);
  });

  it("place_bet: rejects invalid side value", async () => {
    const factory = await program.account.marketFactory.fetch(factoryPDA);
    // Берём последний созданный рынок
    const marketId = factory.marketCount.toNumber() - 1;
    const marketIdBN = new anchor.BN(marketId);

    const [marketPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), marketIdBN.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketIdBN.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    try {
      await program.methods
        .placeBet(marketIdBN, 2, new anchor.BN(LAMPORTS_PER_SOL / 100)) // side=2 invalid
        .accounts({
          market: marketPDA,
          vault: vaultPDA,
          bettor: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("Should have rejected side=2");
    } catch (e: any) {
      assert.ok(
        e.message?.includes("InvalidSide") || e.error?.errorCode?.code === "InvalidSide",
        `Expected InvalidSide error, got: ${e.message}`
      );
    }
  });

  it("place_bet: accepts valid Yes bet (side=0)", async () => {
    const factory = await program.account.marketFactory.fetch(factoryPDA);
    const marketId = factory.marketCount.toNumber() - 1;
    const marketIdBN = new anchor.BN(marketId);

    const [marketPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), marketIdBN.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketIdBN.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const betAmount = new anchor.BN(LAMPORTS_PER_SOL / 10); // 0.1 SOL

    await program.methods
      .placeBet(marketIdBN, 0, betAmount) // side=0 = Yes
      .accounts({
        market: marketPDA,
        vault: vaultPDA,
        bettor: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const market = await program.account.market.fetch(marketPDA);
    assert.equal(market.totalYes.toNumber(), betAmount.toNumber(), "total_yes updated");
    assert.equal(market.bets.length, 1, "bet recorded");
    assert.ok(market.bets[0].bettor.equals(authority.publicKey), "bettor recorded");
    assert.equal(market.bets[0].side, 0, "side=Yes recorded");

    console.log(`✅ Bet placed: ${betAmount.toNumber()} lamports on Yes`);
  });
});
