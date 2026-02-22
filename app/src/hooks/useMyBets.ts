import { useState, useCallback, useEffect } from "react";

export interface Bet {
  id: string;
  roundId: number;
  direction: 'up' | 'down';
  zoneId: string;
  zonePriceMin: number;
  zonePriceMax: number;
  amount: number;
  multiplier: number;
  status: 'pending' | 'won' | 'lost';
  timestamp: number;
  potentialWin: number;
  erPrivate?: boolean;
  txSig?: string;
  claimed?: boolean;
  claimTxSig?: string;
}

const STORAGE_KEY = 'magickbet_bets';

function loadBets(): Bet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Bet[];
  } catch {
    return [];
  }
}

function saveBets(bets: Bet[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
  } catch {
    // игнорируем ошибки хранилища
  }
}

export function useMyBets() {
  const [bets, setBets] = useState<Bet[]>(() => loadBets());

  // Синхронизируем с localStorage при изменении
  useEffect(() => {
    saveBets(bets);
  }, [bets]);

  const addBet = useCallback((bet: Omit<Bet, 'id' | 'timestamp' | 'potentialWin'>) => {
    const newBet: Bet = {
      ...bet,
      id: `bet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      potentialWin: parseFloat((bet.amount * bet.multiplier).toFixed(4)),
    };
    setBets((prev) => [newBet, ...prev]);
    return newBet;
  }, []);

  const removeBet = useCallback((betId: string) => {
    setBets((prev) => prev.filter((b) => b.id !== betId));
  }, []);

  const setBetTxSig = useCallback((betId: string, txSig: string) => {
    setBets((prev) =>
      prev.map((b) => (b.id === betId ? { ...b, txSig } : b)),
    );
  }, []);

  const markRoundClaimed = useCallback((roundId: number, claimTxSig: string) => {
    setBets((prev) =>
      prev.map((b) =>
        b.roundId === roundId && b.status === 'won'
          ? { ...b, claimed: true, claimTxSig }
          : b,
      ),
    );
  }, []);

  const resolveRoundBets = useCallback((roundId: number, winningZoneBottom: number) => {
    const EPS = 0.0001;
    setBets((prev) =>
      prev.map((b) => {
        if (b.roundId !== roundId || b.status !== 'pending') return b;
        const won = Math.abs(b.zonePriceMin - winningZoneBottom) < EPS;
        return { ...b, status: won ? 'won' : 'lost' };
      }),
    );
  }, []);

  const clearBets = useCallback(() => {
    setBets([]);
  }, []);

  const totalWon = bets
    .filter((b) => b.status === 'won')
    .reduce((sum, b) => sum + b.potentialWin, 0);

  const totalLost = bets
    .filter((b) => b.status === 'lost')
    .reduce((sum, b) => sum + b.amount, 0);

  return {
    bets,
    addBet,
    clearBets,
    removeBet,
    setBetTxSig,
    markRoundClaimed,
    resolveRoundBets,
    totalWon,
    totalLost,
  };
}
