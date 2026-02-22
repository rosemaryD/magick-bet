import { useEffect, useCallback } from 'react';
import type { Bet } from '../hooks/useMyBets';

interface MyBetsSidebarProps {
  open: boolean;
  onClose: () => void;
  bets: Bet[];
  clearBets: () => void;
  onClaimBet?: (bet: Bet) => void;
  claimingRoundId?: number | null;
  claimError?: string | null;
  claimSyncMessage?: string;
}

export default function MyBetsSidebar({
  open,
  onClose,
  bets,
  clearBets,
  onClaimBet,
  claimingRoundId = null,
  claimError = null,
  claimSyncMessage = '',
}: MyBetsSidebarProps) {
  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, handleClose]);

  const totalWagered = bets.reduce((sum, b) => sum + b.amount, 0);
  const totalWon = bets.filter((b) => b.status === 'won').reduce((sum, b) => sum + (b.potentialWin || 0), 0);
  const totalLost = bets.filter((b) => b.status === 'lost').reduce((sum, b) => sum + b.amount, 0);
  const pnl = totalWon - totalLost;

  const getStatusLabel = (bet: Bet) => {
    if (bet.status === 'won') {
      if (bet.claimed) {
        return {
          label: 'claimed',
          color: '#22C55E',
          strikethrough: false,
        };
      }
      return {
        label: `+${((bet.potentialWin || 0) - bet.amount).toFixed(2)} WON`,
        color: '#10B981',
        strikethrough: false,
      };
    }
    if (bet.status === 'lost') {
      return {
        label: `-${bet.amount.toFixed(2)} LOST`,
        color: '#EF4444',
        strikethrough: true,
      };
    }
    return { label: 'pending', color: 'rgba(255,255,255,0.55)', strikethrough: false };
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 transition-opacity"
          style={{ zIndex: 90, background: 'rgba(0,0,0,0.4)' }}
          onClick={handleClose}
        />
      )}

      <div
        className="fixed top-0 bottom-0 right-0 flex flex-col transition-transform duration-300"
        style={{
          zIndex: 91,
          width: 300,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          background: 'rgba(8,11,20,0.97)',
          backdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className="text-sm font-bold text-foreground">My Bets</span>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">
            x
          </button>
        </div>

        <div
          className="px-4 py-3 flex gap-3 text-[10px] font-mono shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div>
            <span className="text-muted-foreground">Wagered</span>
            <div className="text-foreground font-medium">{totalWagered.toFixed(2)} SOL</div>
          </div>
          <div>
            <span className="text-muted-foreground">Won</span>
            <div className="font-medium" style={{ color: '#10B981' }}>{totalWon.toFixed(2)} SOL</div>
          </div>
          <div>
            <span className="text-muted-foreground">P&L</span>
            <div className="font-medium" style={{ color: pnl >= 0 ? '#10B981' : '#EF4444' }}>
              {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} SOL {pnl >= 0 ? 'WIN' : 'LOSS'}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
          {claimSyncMessage && (
            <div className="rounded-md px-2.5 py-2 text-[10px] font-mono text-amber-300 border border-amber-500/40 bg-amber-500/10">
              {claimSyncMessage}
            </div>
          )}
          {claimError && (
            <div className="rounded-md px-2.5 py-2 text-[10px] font-mono text-red-300 border border-red-500/40 bg-red-500/10">
              {claimError}
            </div>
          )}

          {bets.length === 0 && (
            <div className="text-center text-muted-foreground text-xs py-8">No bets yet</div>
          )}

          {bets.map((bet, i) => {
            const { label, color, strikethrough } = getStatusLabel(bet);
            return (
              <div
                key={bet.id || i}
                className="flex items-center gap-2.5 rounded-lg p-2.5"
                style={{
                  minHeight: 76,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  opacity: bet.status === 'lost' ? 0.65 : 1,
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{
                    background: bet.direction === 'up' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    color: bet.direction === 'up' ? '#10B981' : '#EF4444',
                  }}
                >
                  {bet.direction === 'up' ? 'UP' : 'DN'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-foreground truncate">
                    ${bet.zonePriceMin.toFixed(2)} - ${bet.zonePriceMax.toFixed(2)}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {bet.multiplier}x - {bet.amount} SOL
                  </div>
                  {bet.erPrivate && (
                    <div className="text-[10px] font-mono" style={{ color: '#10B981' }}>
                      ER private (hidden until reveal)
                    </div>
                  )}
                  {bet.status === 'won' && bet.erPrivate && !bet.claimed && (
                    <div className="text-[10px] font-mono text-amber-300">
                      Onchain claim unavailable for private demo bets
                    </div>
                  )}
                  {bet.txSig && (
                    <div className="text-[10px] font-mono text-muted-foreground truncate">
                      tx: {bet.txSig.slice(0, 8)}...{bet.txSig.slice(-6)}
                    </div>
                  )}
                  {bet.claimTxSig && (
                    <div className="text-[10px] font-mono text-muted-foreground truncate">
                      claim: {bet.claimTxSig.slice(0, 8)}...{bet.claimTxSig.slice(-6)}
                    </div>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <span
                    className={`text-[10px] font-bold font-mono ${strikethrough ? 'line-through' : ''}`}
                    style={{ color }}
                  >
                    {label}
                  </span>
                  {bet.status === 'won' && !bet.claimed && !bet.erPrivate && onClaimBet && (
                    <button
                      className="mt-2 w-full rounded px-2 py-1 text-[10px] font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{
                        background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                        color: '#000',
                      }}
                      onClick={() => onClaimBet(bet)}
                      disabled={claimingRoundId === bet.roundId}
                    >
                      {claimingRoundId === bet.roundId ? 'CLAIMING...' : 'CLAIM'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={clearBets} className="text-[10px] text-muted-foreground hover:text-foreground/60 transition-colors">
            Clear history
          </button>
        </div>
      </div>
    </>
  );
}
