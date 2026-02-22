import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { UserCircle } from 'lucide-react';
import { useIsMobile } from '../hooks/use-mobile';

interface NavbarProps {
  currentPrice: number;
  source: 'pyth_ws' | 'binance_ws' | 'simulated';
  onOpenMyBets: () => void;
}

export default function Navbar({ currentPrice, source, onOpenMyBets }: NavbarProps) {
  const { connected } = useWallet();
  const isMobile = useIsMobile();
  const navbarHeight = isMobile ? 46 : 52;

  const sourceLabels = {
    pyth_ws: 'Pyth',
    binance_ws: 'Binance',
    simulated: 'Simulated',
  };

  const badgeColorClass =
    source === 'pyth_ws'
      ? 'bg-green-500'
      : source === 'binance_ws'
      ? 'bg-yellow-500'
      : 'bg-red-500';

  return (
    <div
      className="fixed top-0 left-0 right-0 flex items-center gap-2"
      style={{
        zIndex: 50,
        height: navbarHeight,
        paddingLeft: isMobile ? 8 : 12,
        paddingRight: isMobile ? 8 : 12,
        background: 'rgba(8,11,20,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div className={`gradient-text font-extrabold tracking-tight shrink-0 ${isMobile ? 'text-sm' : 'text-lg'}`}>
        MagickBet<span className="hidden sm:inline"> ✦</span>
      </div>

      {/* SOL/USD badge */}
      <button
        className={`${isMobile ? 'ml-1 px-2 py-1 rounded-md text-[10px]' : 'ml-4 px-3 py-1.5 rounded-lg text-sm'} font-medium text-foreground/80 hover:text-foreground transition-colors shrink-0`}
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        SOL/USD{!isMobile && <span> ▼</span>}
      </button>

      {/* Price + status */}
      <div className="flex items-center justify-center gap-1.5 flex-1 min-w-0">
        <span className={`font-mono font-bold text-foreground ${isMobile ? 'text-sm' : 'text-xl'}`}>
          ${currentPrice > 0 ? currentPrice.toFixed(2) : '—'}
        </span>

        {/* Sparkline — скрыть на mobile */}
        {!isMobile && (
          <svg width="60" height="20" viewBox="0 0 60 20" className="opacity-60 shrink-0">
            <polyline
              fill="none"
              stroke="#10B981"
              strokeWidth="1.5"
              points="0,15 5,13 10,14 15,10 20,12 25,8 30,9 35,6 40,8 45,5 50,7 55,4 60,6"
            />
          </svg>
        )}

        {/* Status dot */}
        <span className={`flex items-center gap-1.5 ${isMobile ? 'text-[10px]' : 'text-xs'} shrink-0`}>
          <span
            className={`rounded-full inline-block ${badgeColorClass} ${isMobile ? 'w-1.5 h-1.5' : 'w-2 h-2'} shadow-[0_0_8px_currentColor]`}
          />
          <span className="font-medium text-foreground/80">
            {sourceLabels[source]}
          </span>
        </span>
      </div>

      {/* Profile + Wallet — всегда видимы */}
      <div className={`flex items-center shrink-0 ${isMobile ? 'gap-1.5' : 'gap-3'}`}>
        {/* Profile icon */}
        <button
          onClick={onOpenMyBets}
          className="flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          style={{
            width: isMobile ? 28 : 32,
            height: isMobile ? 28 : 32,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
          title={connected ? 'My Bets' : 'Connect wallet and view bets'}
        >
          <UserCircle size={isMobile ? 16 : 20} />
        </button>

        {/* Wallet button */}
        <div className={`wallet-button-wrapper ${isMobile ? 'wallet-button-wrapper--mobile' : ''}`}>
          <WalletMultiButton />
        </div>
      </div>
    </div>
  );
}
