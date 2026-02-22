import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("BFv69p4dBZtPvDcUUnVBhiCCgAFVq5gpEWspnfmKxRKY");
export const L1_RPC = "https://api.devnet.solana.com";
export const ER_RPC = "https://devnet.magicblock.app/";
export const ER_WS_RPC = "wss://devnet.magicblock.app/";
export const DELEGATION_PROGRAM = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
export const PYTH_LAZER_STORAGE = new PublicKey("3rdJbqfnagQ4yx9HXJViD4zc4xpiSqmFsKpPuSCQVyQL");
export const MAGIC_PROGRAM = new PublicKey("Magic11111111111111111111111111111111111111");
export const MAGIC_CONTEXT = new PublicKey("MagicContext1111111111111111111111111111111");
export const ER_ESCROW_INDEX = 0;
export const ER_MIN_ESCROW_LAMPORTS = 5_000_000;
export const ER_DELEGATE_COMMIT_FREQUENCY_MS = 0;
export const ER_FEE_SYNC_WAIT_MS = 3_000;
export const COMMIT_UNDELEGATE_WAIT_MS = 10_000; // 10 seconds base wait
export const COMMIT_UNDELEGATE_POLL_INTERVAL_MS = 2_000;
export const COMMIT_UNDELEGATE_MAX_WAIT_MS = 60_000;
