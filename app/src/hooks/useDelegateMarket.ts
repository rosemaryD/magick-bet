import { useState, useCallback } from 'react';
import { Connection, SystemProgram } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider, BN, Program, Wallet } from '@coral-xyz/anchor';
import idl from '../idl/oracle_bet.json';
import { L1_RPC, DELEGATION_PROGRAM, PROGRAM_ID } from '../constants';
import { deriveDelegationPdas, deriveMarketPda } from '../lib/pda';

function normalizeDelegateError(error: unknown): string {
  if (!(error instanceof Error)) return 'Failed to delegate market';

  if (error.message.includes('WalletSignTransactionError')) {
    return 'Wallet rejected signing. Please approve the transaction in your wallet.';
  }

  return error.message;
}

export function useDelegateMarket() {
  const wallet = useWallet();
  const [delegating, setDelegating] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const delegateMarket = useCallback(
    async (marketId: bigint) => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        setError('Wallet not connected');
        return;
      }

      setDelegating(true);
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

        const marketPda = deriveMarketPda(marketId);
        const marketInfo = await connection.getAccountInfo(marketPda, 'confirmed');
        if (!marketInfo) {
          throw new Error('Market not found on L1');
        }
        if (marketInfo.owner.equals(DELEGATION_PROGRAM)) {
          throw new Error('Market is already delegated to ER');
        }
        if (!marketInfo.owner.equals(PROGRAM_ID)) {
          throw new Error(`Market has unexpected owner: ${marketInfo.owner.toBase58()}`);
        }
        const { bufferPda, delegationRecordPda, delegationMetadataPda } = deriveDelegationPdas(marketPda);

        const sig = await (program.methods as any)
          .delegateMarket(new BN(marketId.toString()))
          .accounts({
            payer: wallet.publicKey,
            market: marketPda,
            buffer: bufferPda,
            delegationRecord: delegationRecordPda,
            delegationMetadata: delegationMetadataPda,
            delegationProgram: DELEGATION_PROGRAM,
            ownerProgram: PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.info('[TX] delegate_market confirmed:', sig);
        setTxSig(sig);
      } catch (e) {
        setError(normalizeDelegateError(e));
      } finally {
        setDelegating(false);
      }
    },
    [wallet],
  );

  return { delegateMarket, delegating, txSig, error };
}
