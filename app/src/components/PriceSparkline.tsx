import React from "react";

interface PriceSparklineProps {
  prices: number[];
  width?: number;
  height?: number;
}

export function PriceSparkline({ prices, width = 120, height = 32 }: PriceSparklineProps) {
  if (prices.length < 2) {
    return <span className="price-sparkline" style={{ width, height, display: "inline-block" }} />;
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const padding = 2;
  const w = width - padding * 2;
  const h = height - padding * 2;

  const points = prices.map((p, i) => {
    const x = padding + (i / (prices.length - 1)) * w;
    const y = padding + h - ((p - min) / range) * h;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const polyline = points.join(" ");
  const isUp = prices[prices.length - 1] >= prices[0];
  const color = isUp ? "#22c55e" : "#ef4444";

  return (
    <span className="price-sparkline">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <polyline
          points={polyline}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
