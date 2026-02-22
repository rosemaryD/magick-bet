interface StatusBarProps {
  countdown: number;
  roundState: 'betting' | 'resolved';
}

export default function StatusBar({ countdown, roundState }: StatusBarProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 h-[44px] flex items-center px-4 justify-between text-xs"
      style={{
        zIndex: 50,
        background: 'rgba(8,11,20,0.85)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <span className="text-primary/80 font-medium">
        ⚡ Powered by MagicBlock ER
      </span>
      <span className="font-mono font-medium" style={{ color: roundState === 'resolved' ? '#10B981' : '#F59E0B' }}>
        {roundState === 'resolved' ? '✓ Round resolved' : `Round closes in ${countdown}s`}
      </span>
      <span className="text-muted-foreground font-mono">
        30s rounds &nbsp;|&nbsp; SOL/USD
      </span>
    </div>
  );
}
