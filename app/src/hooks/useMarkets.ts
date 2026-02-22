import { useEffect, useState, useCallback } from 'react';
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import idl from '../idl/oracle_bet.json';
import { L1_RPC } from '../constants';

export interface MarketData {
  publicKey: PublicKey;
  marketId: bigint;
  creator: PublicKey;
  question: string;
  resolutionPrice: bigint;
  resolutionTime: bigint;
  totalYes: bigint;
  totalNo: bigint;
  status: 'Open' | 'Resolved' | 'Cancelled';
  outcome: 'Unresolved' | 'Yes' | 'No';
  isDelegated: boolean;
  betsCount: number;
}

const READ_ONLY_WALLET = {
  publicKey: Keypair.generate().publicKey,
  signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => tx,
  signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => txs,
} as Wallet;

function toBigIntValue(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string') return BigInt(value);
  if (value && typeof value === 'object' && 'toString' in value) {
    return BigInt((value as { toString: () => string }).toString());
  }
  return 0n;
}

function enumKey(value: unknown): string {
  if (typeof value === 'string') return value.toLowerCase();
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length > 0) return keys[0].toLowerCase();
  }
  return '';
}

function decodeStatus(value: unknown): 'Open' | 'Resolved' | 'Cancelled' {
  const key = enumKey(value);
  if (key === 'open') return 'Open';
  if (key === 'resolved') return 'Resolved';
  return 'Cancelled';
}

function decodeOutcome(value: unknown): 'Unresolved' | 'Yes' | 'No' {
  const key = enumKey(value);
  if (key === 'yes') return 'Yes';
  if (key === 'no') return 'No';
  return 'Unresolved';
}

export function useMarkets() {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const connection = new Connection(L1_RPC, 'confirmed');
      const provider = new AnchorProvider(connection, READ_ONLY_WALLET, { commitment: 'confirmed' });
      const program = new Program(idl as any, provider);

      const accounts = await (program.account as any).market.all();

      const decoded: MarketData[] = accounts.map((entry: any) => {
        const account = entry.account;
        const bets = Array.isArray(account.bets) ? account.bets : [];

        return {
          publicKey: entry.publicKey as PublicKey,
          marketId: toBigIntValue(account.marketId),
          creator: account.creator as PublicKey,
          question: account.question as string,
          resolutionPrice: toBigIntValue(account.resolutionPrice),
          resolutionTime: toBigIntValue(account.resolutionTime),
          totalYes: toBigIntValue(account.totalYes),
          totalNo: toBigIntValue(account.totalNo),
          status: decodeStatus(account.status),
          outcome: decodeOutcome(account.outcome),
          isDelegated: Boolean(account.isDelegated),
          betsCount: bets.length,
        };
      });

      decoded.sort((a, b) => (a.marketId < b.marketId ? -1 : a.marketId > b.marketId ? 1 : 0));
      setMarkets(decoded);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch markets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMarkets();
    const intervalId = setInterval(() => {
      void fetchMarkets();
    }, 5_000);

    return () => clearInterval(intervalId);
  }, [fetchMarkets]);

  return { markets, loading, error, refetch: fetchMarkets };
}
