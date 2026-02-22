import { useState, useEffect, useCallback } from 'react';

interface BetModalProps {
  visible: boolean;
  onClose: () => void;
  direction: 'UP' | 'DOWN';
  zoneLabel: string;
  multiplier: number;
  multiplierColor: string;
  defaultAmount: string;
  countdown: number;
  onPlaceBet?: (amount: number, direction: 'UP' | 'DOWN') => void;
  placing?: boolean;
  submitError?: string | null;
}

const QUICK_AMOUNTS = [0.1, 0.25, 0.5, 1];

export default function BetModal({
  visible,
  onClose,
  direction,
  zoneLabel,
  multiplier,
  multiplierColor,
  defaultAmount,
  countdown,
  onPlaceBet,
  placing = false,
  submitError = null,
}: BetModalProps) {
  const [amount, setAmount] = useState(defaultAmount);
  const [closing, setClosing] = useState(false);

  const numAmount = parseFloat(amount) || 0;
  const payout = parseFloat((numAmount * multiplier).toFixed(4));
  const profit = parseFloat((payout - numAmount).toFixed(4));

  const handleClose = useCallback(() => {
    if (placing) return;
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 250);
  }, [onClose, placing]);

  useEffect(() => {
    if (visible) {
      setAmount(defaultAmount);
      setClosing(false);
    }
  }, [visible, zoneLabel, defaultAmount]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, handleClose]);

  if (!visible && !closing) return null;

  const isUp = direction === 'UP';

  return (
    <>
      <div
        className={`fixed inset-0 transition-opacity duration-250 ${closing ? 'opacity-0' : 'opacity-100'}`}
        style={{ zIndex: 100, background: 'rgba(0,0,0,0.7)' }}
        onClick={handleClose}
      />

      <div
        className="fixed inset-0 z-[101] flex items-end justify-center md:items-center pointer-events-none"
      >
        <div
          className={`w-full md:w-[400px] pointer-events-auto ${closing ? 'animate-slide-down' : 'animate-slide-up'} rounded-t-2xl md:rounded-xl`}
          style={{
            background: 'rgba(10,14,28,0.97)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className="text-sm font-bold text-foreground">Place Bet</span>
          <div className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
            🔒 Private Bet (TEE Secured)
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">x</button>
          </div>

          <div className="px-5 pb-5 space-y-4">
          <div className="space-y-1">
            <span className="text-sm font-bold" style={{ color: isUp ? '#10B981' : '#EF4444' }}>
              {isUp ? 'UP' : 'DOWN'} - {zoneLabel} zone
            </span>
            <div className="text-2xl font-bold font-mono" style={{ color: multiplierColor }}>
              {multiplier}x
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Bet Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono text-muted-foreground">SOL</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 rounded-lg font-mono text-sm text-foreground"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  outline: 'none',
                }}
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  onClick={() => setAmount(q.toString())}
                  className="px-3 py-1 rounded text-xs font-mono transition-colors"
                  style={{
                    background: amount === q.toString() ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
                    color: amount === q.toString() ? '#F59E0B' : 'rgba(255,255,255,0.4)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1 py-2 px-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Potential payout</span>
              <span className="font-mono text-foreground font-medium">{payout > 0 ? payout.toFixed(2) : '0.00'} SOL</span>
            </div>
            {profit > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Profit if win</span>
                <span className="font-mono font-medium" style={{ color: '#10B981' }}>+{profit.toFixed(2)} SOL</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Round closes in</span>
              <span className="font-mono font-bold" style={{ color: countdown <= 2 ? '#EF4444' : '#F59E0B' }}>{countdown}s</span>
            </div>
          </div>

          {submitError && (
            <div className="text-xs text-red-400 border border-red-500/30 rounded-md px-3 py-2 bg-red-500/10">
              {submitError}
            </div>
          )}

          <button
            className="w-full py-3 rounded-[10px] text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              color: '#000',
              height: 48,
            }}
            disabled={placing || numAmount <= 0}
            onClick={() => {
              if (onPlaceBet && numAmount > 0 && !placing) {
                onPlaceBet(numAmount, direction);
              }
            }}
          >
            {placing ? 'SENDING PRIVATE BET...' : 'PLACE BET'}
          </button>

          <button
            onClick={handleClose}
            className="w-full py-2 text-sm text-muted-foreground hover:text-foreground/60 transition-colors"
            disabled={placing}
          >
            Cancel
          </button>
          </div>
        </div>
      </div>
    </>
  );
}
