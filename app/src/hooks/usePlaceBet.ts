import { useState, useCallback } from "react";
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { DELEGATION_PROGRAM, L1_RPC, PROGRAM_ID } from "../constants";

export type BetSide = 0 | 1; // 0 = YES, 1 = NO

interface PlaceBetParams {
  marketId: bigint;
  marketPda: PublicKey;
  vaultPda: PublicKey;
  side: BetSide;
  amountLamports: bigint;
}

// place_bet discriminator: [222, 62, 67, 220, 63, 166, 126, 33]
const PLACE_BET_DISC = Buffer.from([222, 62, 67, 220, 63, 166, 126, 33]);

function encodePlaceBetArgs(marketId: bigint, side: number, amount: bigint): Buffer {
  const buf = Buffer.alloc(8 + 1 + 8); // u64 + u8 + u64
  buf.writeBigUInt64LE(marketId, 0);
  buf.writeUInt8(side, 8);
  buf.writeBigUInt64LE(amount, 9);
  return buf;
}

function normalizePlaceBetError(error: unknown): string {
  if (!(error instanceof Error)) return "Failed to place bet";

  if (error.message.includes("WalletSignTransactionError")) {
    return "Wallet rejected signing. Please approve the transaction in your wallet.";
  }
  if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
    return "RPC is unreachable. Check your network and retry.";
  }

  return error.message;
}

export function usePlaceBet() {
  const { publicKey, sendTransaction, signTransaction } = useWallet();
  const [placing, setPlacing] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const placeBet = useCallback(
    async ({ marketId, marketPda, vaultPda, side, amountLamports }: PlaceBetParams) => {
      if (!publicKey || !signTransaction) {
        setError("Wallet not connected. Connect wallet to place a bet.");
        return;
      }
      setPlacing(true);
      setTxSig(null);
      setError(null);

      try {
        const l1Connection = new Connection(L1_RPC, "confirmed");
        const marketInfo = await l1Connection.getAccountInfo(marketPda, "confirmed");
        if (!marketInfo) {
          throw new Error("Market account not found on L1");
        }
        if (marketInfo.owner.equals(DELEGATION_PROGRAM)) {
          throw new Error(
            "Market is delegated to ER. Placing bets is available only before delegation (L1 mode)."
          );
        }

        const data = Buffer.concat([PLACE_BET_DISC, encodePlaceBetArgs(marketId, side, amountLamports)]);

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

        const { blockhash, lastValidBlockHeight } = await l1Connection.getLatestBlockhash("confirmed");
        const tx = new Transaction({ feePayer: publicKey, blockhash, lastValidBlockHeight }).add(ix);
        const signedTx = await signTransaction(tx);
        const sig = await l1Connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        });
        await l1Connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");

        setTxSig(sig);
        console.info(`[TX] place_bet (L1) confirmed: ${sig}`);
      } catch (e) {
        setError(normalizePlaceBetError(e));
      } finally {
        setPlacing(false);
      }
    },
    [publicKey, sendTransaction, signTransaction]
  );

  return { placeBet, placing, txSig, error };
}
