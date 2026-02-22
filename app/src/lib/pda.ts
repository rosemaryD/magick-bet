import { PublicKey, SystemProgram } from '@solana/web3.js';
import { DELEGATION_PROGRAM, MAGIC_CONTEXT, PROGRAM_ID } from '../constants';

function marketIdToLeBytes(marketId: bigint): Buffer {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(marketId);
  return bytes;
}

export function deriveFactoryPda(): PublicKey {
  const [factoryPda] = PublicKey.findProgramAddressSync([Buffer.from('factory')], PROGRAM_ID);
  return factoryPda;
}

export function deriveMarketPda(marketId: bigint): PublicKey {
  const marketIdBytes = marketIdToLeBytes(marketId);
  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('market'), marketIdBytes],
    PROGRAM_ID,
  );
  return marketPda;
}

export function deriveVaultPda(marketId: bigint): PublicKey {
  const marketIdBytes = marketIdToLeBytes(marketId);
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), marketIdBytes],
    PROGRAM_ID,
  );
  return vaultPda;
}

export function derivePlayerBetPda(marketId: bigint, playerPubkey: PublicKey): PublicKey {
  const marketIdBytes = marketIdToLeBytes(marketId);
  const [playerBetPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('bet'), marketIdBytes, playerPubkey.toBuffer()],
    PROGRAM_ID,
  );
  return playerBetPda;
}

export function deriveDelegationPdas(marketPda: PublicKey) {
  const [bufferPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('buffer'), marketPda.toBuffer()],
    PROGRAM_ID,
  );
  const [delegationRecordPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('delegation'), marketPda.toBuffer()],
    DELEGATION_PROGRAM,
  );
  const [delegationMetadataPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('delegation-metadata'), marketPda.toBuffer()],
    DELEGATION_PROGRAM,
  );

  return {
    bufferPda,
    delegationRecordPda,
    delegationMetadataPda,
  };
}

export function deriveEscrowPda(authority: PublicKey, index: number): PublicKey {
  const [escrowPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('balance'), authority.toBuffer(), Buffer.from([index])],
    DELEGATION_PROGRAM,
  );
  return escrowPda;
}

export function deriveEscrowDelegationPdas(authority: PublicKey, index: number) {
  const escrowPda = deriveEscrowPda(authority, index);
  const [delegateBufferPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('buffer'), escrowPda.toBuffer()],
    SystemProgram.programId,
  );
  const [delegationRecordPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('delegation'), escrowPda.toBuffer()],
    DELEGATION_PROGRAM,
  );
  const [delegationMetadataPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('delegation-metadata'), escrowPda.toBuffer()],
    DELEGATION_PROGRAM,
  );

  return {
    escrowPda,
    delegateBufferPda,
    delegationRecordPda,
    delegationMetadataPda,
  };
}

export function deriveMagicContextPda(): PublicKey {
  return MAGIC_CONTEXT;
}
