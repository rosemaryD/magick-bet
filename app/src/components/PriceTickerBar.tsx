import React from "react";
import { RoundTimer } from "./RoundTimer";

interface PriceTickerBarProps {
  currentPrice: number;
  priceChange24h: number;
  isConnected: boolean;
  roundId: number;
  timeLeft: number;
  progress: number;
  phase: 'betting' | 'resolving' | 'resolved';
  onProfileClick: () => void;
}

export function PriceTickerBar({
  currentPrice,
  priceChange24h,
  isConnected,
  roundId,
  timeLeft,
  progress,
  phase,
  onProfileClick,
}: PriceTickerBarProps) {
  const isPositive = priceChange24h >= 0;
  const changeColor = isPositive ? "#10B981" : "#EF4444";
  const changeArrow = isPositive ? "▲" : "▼";
  const changeStr = `${changeArrow} ${isPositive ? "+" : ""}${priceChange24h.toFixed(2)}%`;

  const priceStr = currentPrice > 0
    ? `$${currentPrice.toFixed(2)}`
    : "Loading...";

  return (
    <header className="ticker-bar">
      {/* Левый блок — лого */}
      <div className="ticker-bar__left">
        <span className="ticker-bar__logo">⚡ MagickBet</span>
      </div>

      {/* Центр — цена */}
      <div className="ticker-bar__center">
        <span className="ticker-bar__pair">SOL/USDT</span>
        <span className="ticker-bar__price">{priceStr}</span>
        {currentPrice > 0 && (
          <span className="ticker-bar__change" style={{ color: changeColor }}>
            {changeStr}
          </span>
        )}
      </div>

      {/* Правый блок — раунд + таймер + профиль + статус */}
      <div className="ticker-bar__right">
        <span className="ticker-bar__round">ROUND #{roundId}</span>

        <div className="ticker-bar__timer-wrap">
          <RoundTimer timeLeft={timeLeft} progress={progress} phase={phase} />
        </div>

        <button
          className="ticker-bar__profile-btn"
          onClick={onProfileClick}
          aria-label="My bets"
          title="My Bets"
        >
          👤
        </button>

        {/* WS статус */}
        <span
          className="ticker-bar__ws-dot"
          title={isConnected ? "Connected" : "Offline"}
          style={{ background: isConnected ? "#10B981" : "#EF4444" }}
        />
      </div>
    </header>
  );
}
