import { useState, useCallback } from 'react';
import { Connection, SystemProgram } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider, BN, Program, Wallet } from '@coral-xyz/anchor';
import idl from '../idl/oracle_bet.json';
import { L1_RPC } from '../constants';
import { deriveFactoryPda, deriveMarketPda, deriveVaultPda } from '../lib/pda';

export interface CreateMarketParams {
  marketId: bigint;
  question: string;
  resolutionPrice: bigint;
  resolutionTime: number;
}

function normalizeCreateError(error: unknown): string {
  if (!(error instanceof Error)) return 'Failed to create market';

  if (error.message.includes('WalletSignTransactionError')) {
    return 'Wallet rejected signing. Please approve the transaction in your wallet.';
  }
  if (error.message.includes('QuestionTooLong')) {
    return 'Question is too long (max 128 characters).';
  }
  if (error.message.includes('InvalidResolutionTime')) {
    return 'Resolution time must be in the future.';
  }

  return error.message;
}

export function useCreateMarket() {
  const wallet = useWallet();
  const [creating, setCreating] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createMarket = useCallback(
    async ({ marketId, question, resolutionPrice, resolutionTime }: CreateMarketParams) => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        setError('Wallet not connected');
        return;
      }

      setCreating(true);
      setError(null);
      setTxSig(null);

      try {
        const connection = new Connection(L1_RPC, 'confirmed');
        const provider = new AnchorProvider(
          connection,
          wallet as unknown as Wallet,
          { commitment: 'confirmed', preflightCommitment: 'confirmed' },
        );
        const program = new Program(idl as any, provider);

        const factoryPda = deriveFactoryPda();
        const marketPda = deriveMarketPda(marketId);
        const vaultPda = deriveVaultPda(marketId);

        const sig = await (program.methods as any)
          .createMarket(
            new BN(marketId.toString()),
            question,
            new BN(resolutionPrice.toString()),
            new BN(resolutionTime),
          )
          .accounts({
            market: marketPda,
            vault: vaultPda,
            factory: factoryPda,
            creator: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.info('[TX] create_market confirmed:', sig);
        setTxSig(sig);
      } catch (e) {
        setError(normalizeCreateError(e));
      } finally {
        setCreating(false);
      }
    },
    [wallet],
  );

  return { createMarket, creating, txSig, error };
}
