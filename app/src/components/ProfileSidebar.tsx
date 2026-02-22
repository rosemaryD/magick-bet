import React, { useEffect } from "react";
import type { Bet } from "../hooks/useMyBets";

interface ProfileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  bets: Bet[];
  totalWon: number;
  totalLost: number;
  onClearBets: () => void;
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function StatusBadge({ status }: { status: Bet['status'] }) {
  const map: Record<Bet['status'], { label: string; color: string }> = {
    pending: { label: "⏳ Pending", color: "#F59E0B" },
    won:     { label: "✅ Won",     color: "#10B981" },
    lost:    { label: "❌ Lost",    color: "#EF4444" },
  };
  const { label, color } = map[status];
  return (
    <span className="bet-status-badge" style={{ color, borderColor: color }}>
      {label}
    </span>
  );
}

export function ProfileSidebar({
  isOpen,
  onClose,
  bets,
  totalWon,
  totalLost,
  onClearBets,
}: ProfileSidebarProps) {
  // Закрыть по Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`sidebar-backdrop${isOpen ? " sidebar-backdrop--open" : ""}`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside className={`profile-sidebar${isOpen ? " profile-sidebar--open" : ""}`}>
        <div className="profile-sidebar__header">
          <h2 className="profile-sidebar__title">MY BETS</h2>
          <button className="profile-sidebar__close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* Статистика */}
        <div className="profile-sidebar__stats">
          <div className="profile-sidebar__stat">
            <span className="profile-sidebar__stat-label">Won</span>
            <span className="profile-sidebar__stat-value" style={{ color: "#10B981" }}>
              🟢 {totalWon.toFixed(4)} SOL
            </span>
          </div>
          <div className="profile-sidebar__stat">
            <span className="profile-sidebar__stat-label">Lost</span>
            <span className="profile-sidebar__stat-value" style={{ color: "#EF4444" }}>
              🔴 {totalLost.toFixed(4)} SOL
            </span>
          </div>
        </div>

        {/* Список ставок */}
        <div className="profile-sidebar__bets">
          {bets.length === 0 ? (
            <div className="profile-sidebar__empty">
              No bets yet. Start trading!
            </div>
          ) : (
            bets.map((bet) => (
              <div key={bet.id} className="profile-sidebar__bet-item">
                <div className="profile-sidebar__bet-top">
                  <span
                    className="profile-sidebar__bet-dir"
                    style={{ color: bet.direction === 'up' ? "#10B981" : "#EF4444" }}
                  >
                    {bet.direction === 'up' ? "↑ UP" : "↓ DOWN"}
                  </span>
                  <span className="profile-sidebar__bet-zone">
                    ${bet.zonePriceMin.toFixed(2)} – ${bet.zonePriceMax.toFixed(2)}
                  </span>
                  <StatusBadge status={bet.status} />
                </div>
                <div className="profile-sidebar__bet-bottom">
                  <span className="profile-sidebar__bet-amount">
                    {bet.amount.toFixed(4)} SOL
                  </span>
                  <span className="profile-sidebar__bet-multiplier">
                    {bet.multiplier.toFixed(1)}×
                  </span>
                  <span className="profile-sidebar__bet-time">
                    {formatTime(bet.timestamp)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Кнопка очистки */}
        {bets.length > 0 && (
          <button className="profile-sidebar__clear-btn" onClick={onClearBets}>
            CLEAR HISTORY
          </button>
        )}
      </aside>
    </>
  );
}
