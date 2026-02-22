import { useState, useEffect } from "react";

export interface RoundState {
  roundId: number;
  timeLeft: number;   // 0-30 секунд
  progress: number;   // 0-1 (для прогресс-бара)
  phase: 'betting' | 'resolving' | 'resolved';
}

const ROUND_DURATION = 30; // секунд
const ROUND_DURATION_MS = ROUND_DURATION * 1000;

function computeRound(): RoundState {
  const now = Date.now();
  const roundId = Math.floor(now / ROUND_DURATION_MS);
  const elapsed = (now % ROUND_DURATION_MS) / 1000; // 0..30
  const timeLeft = Math.max(0, ROUND_DURATION - elapsed);
  const progress = elapsed / ROUND_DURATION; // 0..1

  let phase: RoundState['phase'];
  if (timeLeft < 1.5) {
    phase = 'resolving';
  } else {
    phase = 'betting';
  }

  return { roundId, timeLeft, progress, phase };
}

export function useRound(): RoundState {
  const [state, setState] = useState<RoundState>(computeRound);

  useEffect(() => {
    const interval = setInterval(() => {
      setState(computeRound());
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return state;
}
