import { useState, useCallback } from "react";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  L1_RPC,
  PROGRAM_ID,
  DELEGATION_PROGRAM,
  COMMIT_UNDELEGATE_WAIT_MS,
  COMMIT_UNDELEGATE_POLL_INTERVAL_MS,
  COMMIT_UNDELEGATE_MAX_WAIT_MS,
} from "../constants";

// claim_winnings discriminator: [161, 215, 24, 59, 14, 236, 242, 221]
const CLAIM_WINNINGS_DISC = Buffer.from([161, 215, 24, 59, 14, 236, 242, 221]);

// Market account discriminator: [219, 190, 213, 55, 0, 227, 198, 154]
const MARKET_DISC = Buffer.from([219, 190, 213, 55, 0, 227, 198, 154]);

function encodeClaimWinningsArgs(marketId: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(marketId, 0);
  return buf;
}

function isMarketResolved(data: Buffer): boolean {
  try {
    // Check discriminator
    if (!data.slice(0, 8).equals(MARKET_DISC)) return false;
    // market_id(8) + creator(32) + question_len(4) + question(?) …
    // We need to read status enum — it's after question string, resolution_price, resolution_time, total_yes, total_no
    // Offset after discriminator: 8
    let offset = 8;
    offset += 8; // market_id
    offset += 32; // creator
    const qLen = data.readUInt32LE(offset);
    offset += 4 + qLen; // question
    offset += 8; // resolution_price
    offset += 8; // resolution_time
    offset += 8; // total_yes
    offset += 8; // total_no
    const statusVal = data.readUInt8(offset);
    return statusVal === 1; // 1 = Resolved
  } catch {
    return false;
  }
}

function normalizeClaimError(error: unknown): string {
  if (!(error instanceof Error)) return "Failed to claim winnings";

  if (error.message.includes("WalletSignTransactionError")) {
    return "Wallet rejected signing. Please approve the transaction in your wallet.";
  }
  if (error.message.includes("NoWinningPosition")) {
    return "No claimable onchain winning position found for this wallet.";
  }
  if (error.message.includes("MarketNotResolved")) {
    return "Market is not resolved onchain yet.";
  }
  if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
    return "RPC is unreachable. Check your network and retry.";
  }
  return error.message;
}

export function useClaimWinnings() {
  const { publicKey, sendTransaction } = useWallet();
  const [claiming, setClaiming] = useState(false);
  const [waitingForSync, setWaitingForSync] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string>("");
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const claimWinnings = useCallback(
    async (marketId: bigint, marketPda: PublicKey, vaultPda: PublicKey): Promise<string> => {
      if (!publicKey) {
        const walletError = "Wallet not connected. Connect wallet to claim winnings.";
        setError(walletError);
        throw new Error(walletError);
      }
      setClaiming(true);
      setTxSig(null);
      setError(null);

      try {
        const connection = new Connection(L1_RPC, "confirmed");

        // Fast pre-check: if market account is missing, waiting for sync is pointless.
        const initialMarketInfo = await connection.getAccountInfo(marketPda, "confirmed");
        if (!initialMarketInfo) {
          throw new Error("Onchain market account not found for this bet. Claim is unavailable.");
        }

        let synced = isMarketResolved(initialMarketInfo.data as Buffer);
        if (!synced) {
          // If market is not delegated, there is no ER->L1 sync in progress.
          if (!initialMarketInfo.owner.equals(DELEGATION_PROGRAM)) {
            throw new Error("Market is not resolved on L1. Resolver must finish resolve_market first.");
          }

          setWaitingForSync(true);
          setSyncMessage("Waiting for market state to sync from Ephemeral Rollup to L1...");
          console.info("[ER_SYNC] Waiting for commit_and_undelegate sync to L1 before claim");

          await new Promise((r) => setTimeout(r, COMMIT_UNDELEGATE_WAIT_MS));

          const startTime = Date.now();
          while (Date.now() - startTime < COMMIT_UNDELEGATE_MAX_WAIT_MS) {
            const accountInfo = await connection.getAccountInfo(marketPda, "confirmed");
            if (accountInfo && isMarketResolved(accountInfo.data as Buffer)) {
              synced = true;
              break;
            }
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            setSyncMessage(`Syncing from ER to L1... (${elapsed}s)`);
            await new Promise((r) => setTimeout(r, COMMIT_UNDELEGATE_POLL_INTERVAL_MS));
          }
        }

        if (!synced) {
          console.warn("[ER_SYNC] Timeout waiting for resolved market state on L1");
          const syncError = "Market not yet resolved on L1. Try again in a moment.";
          setError(syncError);
          throw new Error(syncError);
        }

        // Build claim_winnings instruction on L1
        const data = Buffer.concat([CLAIM_WINNINGS_DISC, encodeClaimWinningsArgs(marketId)]);

        const ix = new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: marketPda, isSigner: false, isWritable: true },
            { pubkey: vaultPda, isSigner: false, isWritable: true },
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data,
        });

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        const tx = new Transaction({ blockhash, lastValidBlockHeight, feePayer: publicKey }).add(ix);

        const sig = await sendTransaction(tx, connection, { skipPreflight: true });
        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");

        setTxSig(sig);
        console.info(`[TX] claim_winnings confirmed: ${sig}`);
        return sig;
      } catch (e) {
        const message = normalizeClaimError(e);
        setError(message);
        throw new Error(message);
      } finally {
        setClaiming(false);
        setWaitingForSync(false);
        setSyncMessage("");
      }
    },
    [publicKey, sendTransaction]
  );

  const clearClaimState = useCallback(() => {
    setClaiming(false);
    setWaitingForSync(false);
    setSyncMessage("");
    setTxSig(null);
    setError(null);
  }, []);

  return { claimWinnings, claiming, waitingForSync, syncMessage, txSig, error, clearClaimState };
}
