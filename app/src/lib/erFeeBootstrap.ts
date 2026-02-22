import { SendTransactionOptions } from '@solana/wallet-adapter-base';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  DELEGATION_PROGRAM,
  ER_DELEGATE_COMMIT_FREQUENCY_MS,
  ER_ESCROW_INDEX,
  ER_FEE_SYNC_WAIT_MS,
  ER_MIN_ESCROW_LAMPORTS,
} from '../constants';
import { deriveEscrowDelegationPdas } from './pda';

const TOP_UP_EPHEMERAL_BALANCE_DISC = Buffer.from([9, 0, 0, 0, 0, 0, 0, 0]);
const DELEGATE_EPHEMERAL_BALANCE_DISC = Buffer.from([10, 0, 0, 0, 0, 0, 0, 0]);

export interface EnsureErFeeBootstrapParams {
  connection: Connection;
  publicKey: PublicKey;
  sendTransaction: (
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options?: SendTransactionOptions,
  ) => Promise<string>;
  index?: number;
  minLamports?: number;
  commitFrequencyMs?: number;
  syncWaitMs?: number;
}

export interface EnsureErFeeBootstrapResult {
  escrowPda: PublicKey;
  toppedUp: boolean;
  delegated: boolean;
  topupTx?: string;
  delegateTx?: string;
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

async function sendAndConfirmIx(params: {
  connection: Connection;
  publicKey: PublicKey;
  sendTransaction: EnsureErFeeBootstrapParams['sendTransaction'];
  instruction: TransactionInstruction;
  label: string;
}): Promise<string> {
  const { connection, publicKey, sendTransaction, instruction, label } = params;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction({ feePayer: publicKey, blockhash, lastValidBlockHeight }).add(instruction);
  const signature = await sendTransaction(tx, connection, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });
  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed',
  );
  if (confirmation.value.err) {
    throw new Error(`[ER_FEE] ${label} failed: ${JSON.stringify(confirmation.value.err)}`);
  }
  return signature;
}

function normalizeBootstrapParams(params: EnsureErFeeBootstrapParams) {
  const index = params.index ?? ER_ESCROW_INDEX;
  const minLamports = params.minLamports ?? ER_MIN_ESCROW_LAMPORTS;
  const commitFrequencyMs = params.commitFrequencyMs ?? ER_DELEGATE_COMMIT_FREQUENCY_MS;
  const syncWaitMs = params.syncWaitMs ?? ER_FEE_SYNC_WAIT_MS;

  if (index < 0 || index > 255) {
    throw new Error(`[ER_FEE] Escrow index must be between 0 and 255, got ${index}`);
  }
  if (!Number.isFinite(minLamports) || minLamports < 0) {
    throw new Error(`[ER_FEE] minLamports must be >= 0, got ${minLamports}`);
  }
  if (!Number.isFinite(commitFrequencyMs) || commitFrequencyMs < 0) {
    throw new Error(`[ER_FEE] commitFrequencyMs must be >= 0, got ${commitFrequencyMs}`);
  }
  if (!Number.isFinite(syncWaitMs) || syncWaitMs < 0) {
    throw new Error(`[ER_FEE] syncWaitMs must be >= 0, got ${syncWaitMs}`);
  }

  return {
    index,
    minLamports: Math.floor(minLamports),
    commitFrequencyMs: Math.floor(commitFrequencyMs),
    syncWaitMs: Math.floor(syncWaitMs),
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureErFeeBootstrap(
  params: EnsureErFeeBootstrapParams,
): Promise<EnsureErFeeBootstrapResult> {
  const { connection, publicKey, sendTransaction } = params;
  const { index, minLamports, commitFrequencyMs, syncWaitMs } = normalizeBootstrapParams(params);
  const { escrowPda, delegateBufferPda, delegationRecordPda, delegationMetadataPda } =
    deriveEscrowDelegationPdas(publicKey, index);

  const [escrowInfo, delegationRecordInfo] = await connection.getMultipleAccountsInfo(
    [escrowPda, delegationRecordPda],
    'confirmed',
  );

  const currentEscrowBalance = escrowInfo?.lamports ?? 0;
  const topUpAmount = Math.max(0, minLamports - currentEscrowBalance);

  const result: EnsureErFeeBootstrapResult = {
    escrowPda,
    toppedUp: false,
    delegated: false,
  };

  if (topUpAmount > 0) {
    const topUpIx = new TransactionInstruction({
      programId: DELEGATION_PROGRAM,
      keys: [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: publicKey, isSigner: false, isWritable: false },
        { pubkey: escrowPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([
        TOP_UP_EPHEMERAL_BALANCE_DISC,
        encodeTopUpEphemeralBalanceArgs(BigInt(topUpAmount), index),
      ]),
    });

    result.topupTx = await sendAndConfirmIx({
      connection,
      publicKey,
      sendTransaction,
      instruction: topUpIx,
      label: 'top_up_ephemeral_balance',
    });
    result.toppedUp = true;
  }

  if (delegationRecordInfo === null) {
    const delegateIx = new TransactionInstruction({
      programId: DELEGATION_PROGRAM,
      keys: [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: publicKey, isSigner: true, isWritable: false },
        { pubkey: escrowPda, isSigner: false, isWritable: true },
        { pubkey: delegateBufferPda, isSigner: false, isWritable: true },
        { pubkey: delegationRecordPda, isSigner: false, isWritable: true },
        { pubkey: delegationMetadataPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: DELEGATION_PROGRAM, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([
        DELEGATE_EPHEMERAL_BALANCE_DISC,
        encodeDelegateEphemeralBalanceArgs(commitFrequencyMs, index),
      ]),
    });

    result.delegateTx = await sendAndConfirmIx({
      connection,
      publicKey,
      sendTransaction,
      instruction: delegateIx,
      label: 'delegate_ephemeral_balance',
    });
    result.delegated = true;

    if (syncWaitMs > 0) {
      await sleep(syncWaitMs);
    }
  }

  return result;
}
