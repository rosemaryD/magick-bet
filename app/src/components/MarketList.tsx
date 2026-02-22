import React from "react";
import { useMarkets } from "../hooks/useMarkets";
import { MarketCard } from "./MarketCard";
import { LoadingSpinner } from "./LoadingSpinner";

export function MarketList() {
  // Legacy demo tool: kept for diagnostics and manual testing, not part of the primary hackathon screen.
  const { markets, loading, error, refetch } = useMarkets();

  if (loading) {
    return <LoadingSpinner message="Loading markets from Solana devnet..." />;
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-text">⚠️ Error: {error}</p>
        <button className="btn btn-secondary" onClick={refetch}>
          Retry
        </button>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">📭</div>
        <h2>No markets found on devnet</h2>
        <p>Initialize the factory and create a market first.</p>
        <pre className="empty-state__code">
          cd oracle_bet && npm run test:devnet
        </pre>
        <button className="btn btn-secondary" onClick={refetch}>
          🔄 Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="market-list">
      <div className="market-list__header">
        <h2>Active Markets</h2>
        <div className="market-list__meta">
          <span className="market-count">{markets.length} market{markets.length !== 1 ? "s" : ""}</span>
          <button className="btn btn-secondary btn-sm" onClick={refetch}>
            🔄 Refresh
          </button>
        </div>
      </div>
      <div className="market-list__grid">
        {markets.map((market) => (
          <MarketCard
            key={market.publicKey.toBase58()}
            market={market}
            onRefetch={refetch}
          />
        ))}
      </div>
    </div>
  );
}
