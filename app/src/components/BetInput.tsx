interface BetInputProps {
  amount: string;
  onChange: (val: string) => void;
}

const QUICK = [0.1, 0.25, 0.5, 1.0];

export default function BetInput({ amount, onChange }: BetInputProps) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2"
      style={{
        background: 'rgba(8,11,20,0.9)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Bet:</span>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>◎</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={e => onChange(e.target.value)}
          className="w-20 pl-6 pr-2 py-1.5 rounded-md font-mono text-[12px]"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
            outline: 'none',
          }}
        />
      </div>
      <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>SOL</span>
      <div className="flex gap-1 ml-2">
        {QUICK.map(q => (
          <button
            key={q}
            onClick={() => onChange(q.toString())}
            className="px-2 py-1 rounded text-[10px] font-mono transition-colors"
            style={{
              background: amount === q.toString() ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
              color: amount === q.toString() ? '#F59E0B' : 'rgba(255,255,255,0.4)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
