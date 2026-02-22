import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Zone } from '../hooks/useZones';

interface BetPanelProps {
  zone: Zone | null;
  multiplier: number;
  visible: boolean;
  onClose: () => void;
  countdown: string;
  onPlaceBet: (amount: number) => void;
}

const quickAmounts = [0.1, 0.5, 1.0];

export default function BetPanel({ zone, multiplier, visible, onClose, countdown, onPlaceBet }: BetPanelProps) {
  const { publicKey } = useWallet();
  const [amount, setAmount] = useState('');
  const [closing, setClosing] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);

  const numAmount = parseFloat(amount) || 0;
  const payout = parseFloat((numAmount * multiplier).toFixed(2));
  const profit = parseFloat((payout - numAmount).toFixed(2));

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 280);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, handleClose]);

  useEffect(() => {
    if (visible) {
      setAmount('');
      setClosing(false);
    }
  }, [visible, zone?.id]);

  const handlePlaceBet = async () => {
    if (!publicKey) return;
    if (numAmount <= 0) return;
    setIsPlacing(true);
    try {
      onPlaceBet(numAmount);
      handleClose();
    } finally {
      setIsPlacing(false);
    }
  };

  if (!visible && !closing) return null;

  return (
    <div
      className={`fixed bottom-[44px] left-0 right-0 ${closing ? 'animate-slide-down' : 'animate-slide-up'}`}
      style={{
        zIndex: 40,
        height: 220,
        background: 'rgba(10,14,28,0.95)',
        backdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(124,58,237,0.3)',
      }}
    >
      <div className="h-full flex items-center justify-center gap-12 px-8 max-w-5xl mx-auto">
        {/* Zone info */}
        <div className="space-y-1 min-w-[160px]">
          <p className="text-xs text-muted-foreground">Predicting SOL reaches</p>
          <p className="text-2xl font-bold text-foreground">{zone?.label ?? ''}</p>
          <p className="text-xl font-bold gradient-text">{multiplier}×</p>
        </div>

        {/* Amount input */}
        <div className="space-y-2 min-w-[200px]">
          <label className="text-xs text-muted-foreground">Bet Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">◎</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.1"
              className="w-full pl-8 pr-4 py-2.5 rounded-lg font-mono text-foreground text-sm outline-none focus:ring-1 focus:ring-primary/50"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            />
          </div>
          <div className="flex gap-2">
            {quickAmounts.map(qa => (
              <button
                key={qa}
                onClick={() => setAmount(qa.toString())}
                className="px-3 py-1 rounded text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                {qa}
              </button>
            ))}
            <button
              onClick={() => setAmount('4.20')}
              className="px-3 py-1 rounded text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              MAX
            </button>
          </div>
        </div>

        {/* Payout */}
        <div className="space-y-1 min-w-[140px]">
          <p className="text-xs text-muted-foreground">Potential payout</p>
          <p className="text-2xl font-bold text-win font-mono">◎ {payout > 0 ? payout.toFixed(2) : '0.00'}</p>
          {profit > 0 && (
            <p className="text-sm text-win/80 font-mono">+◎ {profit.toFixed(2)} profit</p>
          )}
          <p className="text-xs text-warning font-mono mt-1">Resolves in {countdown}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 min-w-[140px]">
          {publicKey ? (
            <button
              onClick={handlePlaceBet}
              disabled={numAmount <= 0 || isPlacing}
              className="gradient-primary rounded-lg px-8 py-3.5 text-sm font-bold text-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPlacing ? 'PLACING...' : 'PLACE BET'}
            </button>
          ) : (
            <div className="wallet-button-wrapper">
              <WalletMultiButton style={{
                background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(187 72% 43%))',
                borderRadius: '8px',
                fontSize: '14px',
                height: '48px',
                fontWeight: '700',
              }} />
            </div>
          )}
          <button
            onClick={handleClose}
            className="px-8 py-2 text-sm text-muted-foreground hover:text-foreground/60 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
