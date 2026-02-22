import React, { useEffect, useState } from "react";
import { usePythPrice } from "../hooks/usePythPrice";
import { PriceSparkline } from "./PriceSparkline";

const MAX_HISTORY = 50;

export function LivePriceWidget() {
  const { price, connected, error } = usePythPrice(6); // SOL/USD feed_id = 6
  const [priceHistory, setPriceHistory] = useState<number[]>([]);

  useEffect(() => {
    if (price !== null && price !== undefined) {
      setPriceHistory((prev) => {
        const next = [...prev, price.price];
        return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
      });
    }
  }, [price]);

  return (
    <div className={`price-widget ${connected ? "price-widget--connected" : "price-widget--disconnected"}`}>
      <div className="price-widget__header">
        <span className="price-widget__label">SOL/USD</span>
        <span className={`price-widget__status ${connected ? "status--live" : "status--offline"}`}>
          {connected ? "● LIVE" : "○ OFFLINE"}
        </span>
      </div>

      {price ? (
        <div className="price-widget__price">
          <span className="price-value">${price.price.toFixed(4)}</span>
          <span className="price-confidence">±{price.confidence.toFixed(4)}</span>
          <PriceSparkline prices={priceHistory} width={120} height={32} />
        </div>
      ) : error ? (
        <div className="price-widget__error">
          <span>Pyth Lazer: {error}</span>
          <span className="price-fallback">Using on-chain price</span>
        </div>
      ) : (
        <div className="price-widget__loading">
          <span>Connecting to Pyth Lazer...</span>
        </div>
      )}

      <div className="price-widget__footer">
        <span>Powered by Pyth Lazer · feed_id={6}</span>
        {price && (
          <span>Updated: {new Date(price.publishTime * 1000).toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  );
}
