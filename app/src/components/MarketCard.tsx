import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { MarketData } from "../hooks/useMarkets";
import { BetForm } from "./BetForm";
import { LoadingSpinner } from "./LoadingSpinner";
import { useClaimWinnings } from "../hooks/useClaimWinnings";
import { useCountdown } from "../hooks/useCountdown";
import { useResolveMarket } from "../hooks/useResolveMarket";
import { deriveVaultPda } from "../lib/pda";

interface MarketCardProps {
  market: MarketData;
  onRefetch: () => void;
}

export function MarketCard({ market, onRefetch }: MarketCardProps) {
  // Legacy demo tool: not part of the primary one-screen hackathon flow.
  const [showBetForm, setShowBetForm] = useState(false);
  const { publicKey } = useWallet();
  const { claimWinnings, claiming, waitingForSync, syncMessage, error: claimError } =
    useClaimWinnings();
  const { resolve, isLoading: resolving, error: resolveError } = useResolveMarket();

  const countdown = useCountdown(Number(market.resolutionTime));
  const isExpired = countdown === "РСЃС‚С‘Рє";

  const totalPool = Number(market.totalYes + market.totalNo) / 1e9;
  const yesPercent =
    market.totalYes + market.totalNo > 0n
      ? Math.round(
          (Number(market.totalYes) * 100) / Number(market.totalYes + market.totalNo)
        )
      : 50;

  const resTime = new Date(Number(market.resolutionTime) * 1000).toLocaleString();
  const resPriceUsd = (Number(market.resolutionPrice) / 1e9).toFixed(2);
  const isOpen = market.status === "Open";
  const canPlaceBet = isOpen && !market.isDelegated && !isExpired;
  const canResolve = isOpen && market.isDelegated && isExpired;

  const handleClaim = async () => {
    const vaultPda = deriveVaultPda(market.marketId);
    await claimWinnings(market.marketId, market.publicKey, vaultPda);
    onRefetch();
  };

  const handleResolve = async () => {
    await resolve({ marketId: market.marketId, marketPubkey: market.publicKey });
    onRefetch();
  };

  return (
    <div className={`market-card market-card--${market.status.toLowerCase()}`}>
      <div className="market-card__header">
        <span
          className={`market-status market-status--${market.status.toLowerCase()}`}
        >
          {market.status}
          {market.isDelegated && " вљЎER"}
        </span>
        <span className="market-id">#{market.marketId.toString()}</span>
      </div>

      <h3 className="market-question">{market.question}</h3>

      {/* Countdown Timer */}
      {market.status !== "Resolved" && market.status !== "Cancelled" && (
        <div className={`market-countdown${isExpired ? " expired" : ""}`}>
          {isExpired ? "вЏ° РСЃС‚С‘Рє" : `вЏ° Р”Рѕ СЂРµР·РѕР»СЋС†РёРё: ${countdown}`}
        </div>
      )}

      <div className="market-stats">
        <div className="market-stat">
          <span className="stat-label">Pool</span>
          <span className="stat-value">{totalPool.toFixed(3)} SOL</span>
        </div>
        <div className="market-stat">
          <span className="stat-label">Target Price</span>
          <span className="stat-value">${resPriceUsd}</span>
        </div>
        <div className="market-stat">
          <span className="stat-label">Closes</span>
          <span className="stat-value">{resTime}</span>
        </div>
        <div className="market-stat">
          <span className="stat-label">Bets</span>
          <span className="stat-value">{market.betsCount}</span>
        </div>
      </div>

      <div className="market-odds">
        <div className="odds-bar">
          <div className="odds-yes" style={{ width: `${yesPercent}%` }}>
            YES {yesPercent}%
          </div>
          <div className="odds-no" style={{ width: `${100 - yesPercent}%` }}>
            NO {100 - yesPercent}%
          </div>
        </div>
      </div>

      {canPlaceBet && (
        <div className="market-actions">
          <button className="btn btn-yes" onClick={() => setShowBetForm(true)}>
            Place Bet (L1)
          </button>
        </div>
      )}

      {isOpen && market.isDelegated && !isExpired && (
        <div className="market-actions">
          <p className="market-note">Betting is locked after delegation. Waiting for resolution.</p>
        </div>
      )}

      {isOpen && !market.isDelegated && isExpired && (
        <div className="market-actions">
          <p className="market-note">Delegate this market to ER before resolving.</p>
        </div>
      )}

      {/* Resolve Market button - only when market is delegated and expired */}
      {canResolve && publicKey && (
        <div className="market-actions">
          {resolving ? (
            <LoadingSpinner message="Resolving..." />
          ) : (
            <button
              className="btn-resolve"
              onClick={handleResolve}
              disabled={resolving}
            >
              Resolve Market
            </button>
          )}
          {resolveError && <p className="error-text">{resolveError}</p>}
        </div>
      )}

      {showBetForm && (
        <BetForm
          market={market}
          onClose={() => setShowBetForm(false)}
          onSuccess={() => {
            setShowBetForm(false);
            onRefetch();
          }}
        />
      )}

      {market.status === "Resolved" && market.outcome !== "Unresolved" && (
        <div className="market-outcome">
          <div className={`outcome-badge outcome-badge--${market.outcome.toLowerCase()}`}>
            Outcome: <strong>{market.outcome}</strong>
          </div>
          {/* Show resolve result label */}
          <div className="resolve-result">
            {market.outcome === "Yes" ? "вњ… YES wins!" : "вњ… NO wins!"}
          </div>
          {waitingForSync ? (
            <LoadingSpinner message={syncMessage} />
          ) : (
            <button
              className="btn btn-claim"
              disabled={claiming}
              onClick={handleClaim}
            >
              {claiming ? "Claiming..." : "Claim Winnings рџЏ†"}
            </button>
          )}
          {claimError && <p className="error-text">{claimError}</p>}
        </div>
      )}

      {market.status === "Cancelled" && (
        <div className="market-outcome">
          <div className="outcome-badge outcome-badge--cancelled">Cancelled</div>
        </div>
      )}
    </div>
  );
}

