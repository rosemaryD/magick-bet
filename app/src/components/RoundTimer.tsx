import React from "react";

interface RoundTimerProps {
  timeLeft: number;
  progress: number; // 0-1
  phase: 'betting' | 'resolving' | 'resolved';
}

const SIZE = 40;
const STROKE = 3;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function RoundTimer({ timeLeft, progress, phase }: RoundTimerProps) {
  // progress 0 = начало раунда (полный круг), 1 = конец (пустой)
  const dashOffset = CIRCUMFERENCE * progress;
  const seconds = Math.ceil(timeLeft);
  const isResolving = phase === 'resolving';

  return (
    <div
      className={`round-timer${isResolving ? " round-timer--resolving" : ""}`}
      title={`${seconds}s left in round`}
    >
      <svg width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }}>
        {/* Фоновое кольцо */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={STROKE}
        />
        {/* Прогресс-кольцо */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={isResolving ? "#EF4444" : "#F59E0B"}
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.1s linear" }}
        />
      </svg>
      <span className="round-timer__label">{seconds}</span>
    </div>
  );
}
