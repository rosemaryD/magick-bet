interface CountdownTimerProps {
  seconds: number;
  roundState: 'betting' | 'resolved';
  size?: number;
}

export default function CountdownTimer({ seconds, roundState, size = 56 }: CountdownTimerProps) {
  const isUrgent = seconds <= 2 && roundState === 'betting';
  const borderColor = roundState === 'resolved'
    ? 'rgba(16,185,129,0.6)'
    : isUrgent
      ? 'rgba(239,68,68,0.7)'
      : 'rgba(245,158,11,0.5)';
  const textColor = roundState === 'resolved'
    ? '#10B981'
    : isUrgent
      ? '#EF4444'
      : '#F59E0B';

  const bettingFontSize = size <= 44 ? 18 : 22;
  const resolvedFontSize = size <= 44 ? 8 : 10;

  return (
    <div
      className="flex items-center justify-center rounded-full font-mono font-bold"
      style={{
        width: size,
        height: size,
        border: `2px solid ${borderColor}`,
        background: roundState === 'resolved'
          ? 'rgba(16,185,129,0.1)'
          : isUrgent
            ? 'rgba(239,68,68,0.08)'
            : 'rgba(245,158,11,0.08)',
        color: textColor,
        fontSize: roundState === 'resolved' ? resolvedFontSize : bettingFontSize,
        backdropFilter: 'blur(12px)',
        transition: 'all 0.3s ease',
      }}
    >
      {roundState === 'resolved' ? 'RESOLVED' : seconds}
    </div>
  );
}
