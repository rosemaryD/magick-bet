import { useState } from 'react';
import { Bet } from '../hooks/useMyBets';

interface MySidebarProps {
  bets: Bet[];
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'won')
    return (
      <span
        className="text-[9px] font-bold text-win px-1.5 py-0.5 rounded whitespace-nowrap"
        style={{ background: 'rgba(16,185,129,0.15)', boxShadow: '0 0 8px rgba(16,185,129,0.3)' }}
      >
        ✓ WON
      </span>
    );
  if (status === 'lost')
    return (
      <span
        className="text-[9px] font-bold text-destructive px-1.5 py-0.5 rounded line-through whitespace-nowrap"
        style={{ background: 'rgba(239,68,68,0.1)' }}
      >
        ✗ LOST
      </span>
    );
  return (
    <span
      className="text-[9px] font-bold text-muted-foreground px-1.5 py-0.5 rounded whitespace-nowrap"
      style={{ background: 'rgba(255,255,255,0.06)' }}
    >
      PENDING
    </span>
  );
}

export default function MySidebar({ bets }: MySidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const totalRisk = bets.reduce((s, b) => s + b.amount, 0);
  const potentialWin =
    bets.filter(b => b.status === 'pending').reduce((s, b) => s + b.potentialWin, 0) +
    bets.filter(b => b.status === 'won').reduce((s, b) => s + b.potentialWin, 0);

  return (
    <div
      className="absolute right-0 flex flex-col transition-all duration-300"
      style={{
        zIndex: 20,
        top: 52,
        bottom: 44,
        width: collapsed ? 40 : 260,
        background: 'rgba(8,11,20,0.9)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 shrink-0">
        {!collapsed && (
          <span className="text-xs font-semibold text-foreground">
            My Bets ({bets.length})
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-muted-foreground hover:text-foreground transition-colors text-sm ml-auto"
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Bet cards */}
          <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1.5">
            {bets.length === 0 && (
              <div className="text-center text-muted-foreground text-xs py-8">
                No bets yet
              </div>
            )}
            {bets.map(bet => (
              <div
                key={bet.id}
                className="rounded-lg p-2.5 space-y-1.5"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  opacity: bet.status === 'lost' ? 0.5 : 1,
                }}
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-xs text-foreground truncate mr-2">
                    {bet.zonePriceMin.toFixed(2)}–{bet.zonePriceMax.toFixed(2)}
                  </span>
                  <StatusBadge status={bet.status} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span className={`font-bold ${bet.direction === 'up' ? 'text-win' : 'text-destructive'}`}>
                    {bet.direction === 'up' ? '↑ UP' : '↓ DOWN'}
                  </span>
                  <span>◎ {bet.amount}</span>
                  <span>{bet.multiplier}×</span>
                </div>
                {bet.status === 'pending' && (
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full bg-warning"
                      style={{ width: '60%', transition: 'width 1s linear' }}
                    />
                  </div>
                )}
                {bet.status === 'won' && (
                  <div className="text-[10px] font-mono text-win font-medium">
                    Won ◎ {bet.potentialWin.toFixed(4)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="px-2 py-2 border-t border-border/30 text-[10px] font-mono text-muted-foreground flex justify-between shrink-0">
            <span>Risk ◎ {totalRisk.toFixed(2)}</span>
            <span className="text-win">Win ◎ {potentialWin.toFixed(2)}</span>
          </div>
        </>
      )}
    </div>
  );
}
