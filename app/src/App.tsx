import { useState, useCallback, useEffect, useRef } from 'react';
import { useRound } from './hooks/useRound';
import { useMyBets } from './hooks/useMyBets';
import MarketUnifiedBoard, {
  MARKET_ZONE_STEP,
  type SelectedBet,
} from './components/MarketUnifiedBoard';
import Navbar from './components/Navbar';
import StatusBar from './components/StatusBar';
import CountdownTimer from './components/CountdownTimer';
import BetInput from './components/BetInput';
import BetModal from './components/BetModal';
import MyBetsSidebar from './components/MyBetsSidebar';
import { useIsMobile } from './hooks/use-mobile';
import { useRuntimePrice } from './hooks/useRuntimePrice';
import { useCreatePrivateBet } from './hooks/useCreatePrivateBet';
import { useClaimWinnings } from './hooks/useClaimWinnings';
import { deriveMarketPda, deriveVaultPda } from './lib/pda';
import { toast } from 'sonner';

function getMultiplier(distance: number): { mult: number; color: string } {
  if (distance <= 2) return { mult: 1.5, color: '#F59E0B' };
  if (distance <= 4) return { mult: 2.1, color: '#F97316' };
  if (distance <= 7) return { mult: 4.2, color: '#EA580C' };
  if (distance <= 10) return { mult: 9, color: '#EF4444' };
  return { mult: 20, color: '#DC2626' };
}

export default function App() {
  const runtimePrice = useRuntimePrice();
  const isMobile = useIsMobile();
  const navbarHeight = isMobile ? 46 : 52;
  const countdownSize = isMobile ? 44 : 56;
  const { timeLeft, phase, roundId } = useRound();
  const { bets, addBet, clearBets, resolveRoundBets, setBetTxSig, removeBet, markRoundClaimed } = useMyBets();
  const { createPrivateBet, loading: creatingPrivateBet, error: privateBetError } = useCreatePrivateBet();
  const {
    claimWinnings,
    claiming,
    waitingForSync,
    syncMessage,
    error: claimError,
    clearClaimState,
  } = useClaimWinnings();

  const [chartFallbackPrice, setChartFallbackPrice] = useState(187.42);
  const effectivePrice = runtimePrice.currentPrice > 0 ? runtimePrice.currentPrice : chartFallbackPrice;

  const roundState: 'betting' | 'resolved' = phase === 'betting' ? 'betting' : 'resolved';
  const countdown = Math.ceil(Math.max(0, timeLeft));

  const [selectedBet, setSelectedBet] = useState<SelectedBet | null>(null);
  const [betAmount, setBetAmount] = useState('0.1');
  const [winningZoneBottom, setWinningZoneBottom] = useState<number | null>(null);
  const [roundStartPrice, setRoundStartPrice] = useState(effectivePrice);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalDirection, setModalDirection] = useState<'UP' | 'DOWN'>('UP');
  const [modalZone, setModalZone] = useState('$187.00');
  const [modalMult, setModalMult] = useState(1.5);
  const [modalMultColor, setModalMultColor] = useState('#F59E0B');

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [claimingRoundId, setClaimingRoundId] = useState<number | null>(null);

  const hasOnchainClaimableBets = bets.some((b) => b.status === 'won' && !b.claimed && !b.erPrivate);

  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    if (prevPhaseRef.current === 'betting' && phase === 'resolving') {
      const zoneBottom = parseFloat(
        (Math.floor(effectivePrice / MARKET_ZONE_STEP) * MARKET_ZONE_STEP).toFixed(2),
      );
      setWinningZoneBottom(zoneBottom);
      resolveRoundBets(roundId, zoneBottom);
      setSelectedBet(null);
      setModalOpen(false);
    }

    if (prevPhaseRef.current !== 'betting' && phase === 'betting') {
      setWinningZoneBottom(null);
      setRoundStartPrice(effectivePrice);
    }

    prevPhaseRef.current = phase;
  }, [effectivePrice, phase, resolveRoundBets, roundId]);

  useEffect(() => {
    if (!hasOnchainClaimableBets && !claiming && !waitingForSync) {
      clearClaimState();
    }
  }, [hasOnchainClaimableBets, claiming, waitingForSync, clearClaimState]);

  const handlePriceUpdate = useCallback((price: number) => {
    setChartFallbackPrice(price);
  }, []);

  const handleSelectBet = useCallback(
    (selection: SelectedBet | null) => {
      if (!selection) {
        setSelectedBet(null);
        setModalOpen(false);
        return;
      }

      const { mult, color } = getMultiplier(selection.distance);

      setSelectedBet(selection);
      setModalDirection(selection.direction);
      setModalZone(`$${selection.priceBottom.toFixed(2)}`);
      setModalMult(mult);
      setModalMultColor(color);
      setModalOpen(true);
    },
    [],
  );

  const handlePlaceBet = useCallback(
    async (amount: number, direction: 'UP' | 'DOWN') => {
      const bottom =
        selectedBet?.priceBottom ?? parseFloat((Math.floor(effectivePrice / MARKET_ZONE_STEP) * MARKET_ZONE_STEP).toFixed(2));
      const top = selectedBet?.priceTop ?? parseFloat((bottom + MARKET_ZONE_STEP).toFixed(2));
      const createdBet = addBet({
        roundId,
        direction: direction === 'UP' ? 'up' : 'down',
        zoneId: `zone_${bottom.toFixed(2)}`,
        zonePriceMin: bottom,
        zonePriceMax: top,
        amount,
        multiplier: modalMult,
        status: 'pending',
        erPrivate: true,
      });

      try {
        const amountLamports = BigInt(Math.max(1, Math.floor(amount * 1_000_000_000)));
        const side: 0 | 1 = direction === 'UP' ? 0 : 1;

        const result = await createPrivateBet({
          marketId: BigInt(roundId),
          side,
          amountLamports,
        });

        console.info(
          `[TX] private bet created=${result.created} delegated=${result.delegated} sig=${result.signature}`,
        );
        setBetTxSig(createdBet.id, result.signature);
        toast.success(`Bet sent: ${result.signature.slice(0, 8)}...`);
        setModalOpen(false);
        setSelectedBet(null);
      } catch (error) {
        console.error('[TX] private bet failed:', error);
        removeBet(createdBet.id);
        toast.error(error instanceof Error ? error.message : 'Failed to place private bet');
      }
    },
    [effectivePrice, selectedBet, modalMult, addBet, createPrivateBet, removeBet, roundId, setBetTxSig],
  );

  const handleClaimBet = useCallback(
    async (bet: { roundId: number; claimed?: boolean; erPrivate?: boolean; status: 'pending' | 'won' | 'lost' }) => {
      if (bet.status !== 'won') {
        toast.error('Claim is available only for winning bets.');
        return;
      }
      if (bet.claimed) {
        toast.message('This round is already claimed.');
        return;
      }
      if (bet.erPrivate) {
        clearClaimState();
        toast.message('Private demo bets are hidden and currently do not support onchain claim.');
        return;
      }

      setClaimingRoundId(bet.roundId);
      try {
        const marketId = BigInt(bet.roundId);
        const marketPda = deriveMarketPda(marketId);
        const vaultPda = deriveVaultPda(marketId);
        const sig = await claimWinnings(marketId, marketPda, vaultPda);
        markRoundClaimed(bet.roundId, sig);
        toast.success(`Claim sent: ${sig.slice(0, 8)}...`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Claim failed');
      } finally {
        setClaimingRoundId(null);
      }
    },
    [claimWinnings, clearClaimState, markRoundClaimed],
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: '#080B14' }}>
      <Navbar
        currentPrice={effectivePrice}
        source={runtimePrice.source}
        onOpenMyBets={() => setSidebarOpen(true)}
      />

      <div className="absolute flex flex-col" style={{ top: navbarHeight, bottom: 44, left: 0, right: 0 }}>
        <div className="relative flex-1 min-h-0">
          <MarketUnifiedBoard
            currentPrice={effectivePrice}
            onPriceUpdate={handlePriceUpdate}
            initialPrice={187.42}
            roundStartPrice={roundStartPrice}
            externalPrice={runtimePrice.currentPrice > 0 ? runtimePrice.currentPrice : undefined}
            selectedBet={selectedBet}
            onSelectBet={handleSelectBet}
            roundState={roundState}
            winningZoneBottom={winningZoneBottom}
            isMobile={isMobile}
          />

          <div className="absolute" style={{ top: isMobile ? 8 : 10, right: isMobile ? 76 : 90, zIndex: 40 }}>
            <CountdownTimer seconds={countdown} roundState={roundState} size={countdownSize} />
          </div>
        </div>

        <BetInput amount={betAmount} onChange={setBetAmount} />
      </div>

      <StatusBar countdown={countdown} roundState={roundState} />

      <BetModal
        visible={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedBet(null);
        }}
        direction={modalDirection}
        zoneLabel={modalZone}
        multiplier={modalMult}
        multiplierColor={modalMultColor}
        defaultAmount={betAmount}
        countdown={countdown}
        onPlaceBet={handlePlaceBet}
        placing={creatingPrivateBet}
        submitError={privateBetError}
      />

      <MyBetsSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        bets={bets}
        clearBets={clearBets}
        onClaimBet={handleClaimBet}
        claimingRoundId={claiming ? claimingRoundId : null}
        claimError={hasOnchainClaimableBets ? claimError : null}
        claimSyncMessage={waitingForSync ? syncMessage : ''}
      />
    </div>
  );
}
