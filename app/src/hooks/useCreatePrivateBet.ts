import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider, BN, Program, Wallet } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import idl from '../idl/oracle_bet.json';
import { DELEGATION_PROGRAM, PROGRAM_ID } from '../constants';
import { derivePlayerBetPda, deriveDelegationPdas } from '../lib/pda';

export interface CreatePrivateBetParams {
  marketId: bigint;
  side: 0 | 1;
  amountLamports: bigint;
}

export interface CreatePrivateBetResult {
  signature: string;
  playerBetPda: PublicKey;
  created: boolean;
  delegated: boolean;
}

const CONFIRM_TIMEOUT_MS = 30_000;

function normalizePrivateBetError(error: unknown): string {
  if (!(error instanceof Error)) return 'Failed to create private bet';

  if (error.message.includes('WalletSignTransactionError')) {
    return 'Wallet rejected signing. Please approve the transaction in your wallet.';
  }

  if (error.message.includes('already in use')) {
    return 'Private bet for this market and wallet already exists.';
  }

  if (error.message.includes('Blockhash not found')) {
    return 'Transaction expired before confirmation. Please retry and confirm faster in wallet.';
  }

  if (error.message.includes('confirmation timed out')) {
    return 'Transaction sent but confirmation timed out. Check Explorer and retry if needed.';
  }

  if (
    error.message.includes('Attempt to debit an account but found no record of a prior credit') ||
    error.message.includes('insufficient funds') ||
    error.message.includes('insufficient lamports')
  ) {
    return 'Insufficient devnet SOL for fees. Airdrop/fund wallet on devnet and retry.';
  }

  return error.message;
}

export function useCreatePrivateBet() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);

  const createPrivateBet = async ({ marketId, side, amountLamports }: CreatePrivateBetParams): Promise<CreatePrivateBetResult> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }
    if (amountLamports <= 0n) {
      throw new Error('Bet amount must be greater than 0');
    }

    setLoading(true);
    setError(null);
    setTxSig(null);

    try {
      const walletLamports = await connection.getBalance(wallet.publicKey, 'confirmed');
      if (walletLamports < 200_000) {
        throw new Error('Insufficient devnet SOL for fees. Airdrop/fund wallet on devnet and retry.');
      }

      const provider = new AnchorProvider(
        connection,
        wallet as unknown as Wallet,
        { commitment: 'confirmed', preflightCommitment: 'confirmed' },
      );
      const program = new Program(idl as any, provider);

      const playerBetPda = derivePlayerBetPda(marketId, wallet.publicKey);
      const { bufferPda, delegationRecordPda, delegationMetadataPda } = deriveDelegationPdas(playerBetPda);

      const playerBetInfo = await connection.getAccountInfo(playerBetPda, 'confirmed');

      const tx = new Transaction();
      let created = false;
      let delegated = false;

      if (!playerBetInfo) {
        const createIx = await (program.methods as any)
          .createPrivateBet(new BN(marketId.toString()), side, new BN(amountLamports.toString()))
          .accounts({
            payer: wallet.publicKey,
            playerBet: playerBetPda,
            systemProgram: SystemProgram.programId,
          })
          .instruction();

        tx.add(createIx);
        created = true;
      }

      const latestInfo = playerBetInfo ?? (await connection.getAccountInfo(playerBetPda, 'confirmed'));
      const alreadyDelegated = latestInfo?.owner.equals(DELEGATION_PROGRAM) ?? false;

      if (!alreadyDelegated) {
        const delegateIx = await (program.methods as any)
          .delegatePrivateBet(new BN(marketId.toString()))
          .accounts({
            payer: wallet.publicKey,
            playerBet: playerBetPda,
            buffer: bufferPda,
            delegationRecord: delegationRecordPda,
            delegationMetadata: delegationMetadataPda,
            delegationProgram: DELEGATION_PROGRAM,
            ownerProgram: PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();

        tx.add(delegateIx);
        delegated = true;
      }

      if (tx.instructions.length === 0) {
        throw new Error('Private bet already exists and is delegated');
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      tx.feePayer = wallet.publicKey;
      tx.recentBlockhash = blockhash;

      const signedTx = await wallet.signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      setTxSig(signature);

      const confirmation = await Promise.race([
        connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed'),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Transaction confirmation timed out')), CONFIRM_TIMEOUT_MS),
        ),
      ]);

      if (confirmation.value.err) {
        throw new Error(`create_private_bet failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.info(`[TX] private_bet confirmed: ${signature}`);

      return {
        signature,
        playerBetPda,
        created,
        delegated,
      };
    } catch (e) {
      const message = normalizePrivateBetError(e);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  return { createPrivateBet, loading, error, txSig };
}
