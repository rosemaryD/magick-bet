import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

interface PricePoint {
  time: number;
  price: number;
}

const ZONE_WIDTH = 0.10; // 10 cents step
const ZONE_COUNT = 40;
const TIME_WINDOW = 30;
const RIGHT_MARGIN = 56;
const BOTTOM_MARGIN = 28;

function getMultiplier(distance: number): { mult: number; color: string } {
  if (distance <= 2) return { mult: 1.5, color: '#F59E0B' };
  if (distance <= 4) return { mult: 2.1, color: '#F97316' };
  if (distance <= 7) return { mult: 4.2, color: '#EA580C' };
  if (distance <= 10) return { mult: 9, color: '#EF4444' };
  return { mult: 20, color: '#DC2626' };
}

export interface ZoneInfo {
  priceBottom: number;
  priceTop: number;
  distance: number;
  isCurrent: boolean;
}

function buildZones(currentPrice: number): ZoneInfo[] {
  const snapped = Math.round(currentPrice / ZONE_WIDTH) * ZONE_WIDTH;
  const half = Math.floor(ZONE_COUNT / 2);
  const zones: ZoneInfo[] = [];
  for (let i = half; i >= -half + 1; i--) {
    const bottom = parseFloat((snapped + (i - 1) * ZONE_WIDTH).toFixed(2));
    const top = parseFloat((snapped + i * ZONE_WIDTH).toFixed(2));
    const isCurrent = currentPrice >= bottom && currentPrice < top;
    const midZone = (bottom + top) / 2;
    const distance = Math.round(Math.abs(midZone - currentPrice) / ZONE_WIDTH);
    zones.push({ priceBottom: bottom, priceTop: top, distance, isCurrent });
  }
  return zones;
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export { buildZones, ZONE_WIDTH };

interface ChartGridProps {
  currentPrice: number;
  onPriceUpdate?: (price: number) => void;
  initialPrice: number;
  roundStartPrice: number;
  selectedZone: number | null;
  onSelectZone: (index: number | null) => void;
  roundState: 'betting' | 'resolved';
  winningZoneBottom: number | null;
  externalPrice?: number;
}

export default function ChartGrid({
  currentPrice: propCurrentPrice,
  onPriceUpdate,
  initialPrice,
  roundStartPrice,
  selectedZone,
  onSelectZone,
  roundState,
  winningZoneBottom,
  externalPrice,
}: ChartGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const priceHistoryRef = useRef<PricePoint[]>([]);
  const animFrameRef = useRef<number>(0);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [hoveredZone, setHoveredZone] = useState<number | null>(null);

  const [localPrice, setLocalPrice] = useState(initialPrice);
  const actualPrice = externalPrice && externalPrice > 0 ? externalPrice : localPrice;

  const zones = useMemo(() => buildZones(actualPrice), [actualPrice]);

  // Chart area dimensions
  const chartLeft = 0;
  const chartRight = dimensions.width - RIGHT_MARGIN;
  const chartTop = 0;
  const chartBottom = dimensions.height - BOTTOM_MARGIN;
  const chartH = chartBottom - chartTop;

  // Price range from zones
  const topPrice = zones.length > 0 ? zones[0].priceTop : actualPrice + 1;
  const bottomPrice = zones.length > 0 ? zones[zones.length - 1].priceBottom : actualPrice - 1;
  const priceRange = topPrice - bottomPrice;

  const priceToY = useCallback((p: number) => {
    if (priceRange <= 0) return chartH / 2;
    return chartTop + chartH * (1 - (p - bottomPrice) / priceRange);
  }, [chartTop, chartH, bottomPrice, priceRange]);

  // Init price history
  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    let price = initialPrice - 1;
    const history: PricePoint[] = [];
    for (let i = TIME_WINDOW + 10; i >= 0; i--) {
      price += (Math.random() - 0.48) * 0.15;
      price = Math.max(initialPrice - 3, Math.min(initialPrice + 3, price));
      history.push({ time: now - i, price: parseFloat(price.toFixed(2)) });
    }
    history[history.length - 1].price = initialPrice;
    priceHistoryRef.current = history;
  }, [initialPrice]);

  // Price ticker (Live or Mock)
  useEffect(() => {
    if (externalPrice && externalPrice > 0) {
      const now = Math.floor(Date.now() / 1000);
      const history = priceHistoryRef.current;
      history.push({ time: now, price: externalPrice });
      const cutoff = now - 60;
      while (history.length > 0 && history[0].time < cutoff) history.shift();
      if (onPriceUpdate) onPriceUpdate(externalPrice);
      return;
    }

    // Mock ticker if no external price
    const interval = setInterval(() => {
      const history = priceHistoryRef.current;
      const lastPrice = history.length > 0 ? history[history.length - 1].price : initialPrice;
      let newPrice = lastPrice + (Math.random() - 0.5) * 0.12;
      newPrice = parseFloat(newPrice.toFixed(2));
      const now = Math.floor(Date.now() / 1000);
      history.push({ time: now, price: newPrice });
      const cutoff = now - 60;
      while (history.length > 0 && history[0].time < cutoff) history.shift();
      setLocalPrice(newPrice);
      if (onPriceUpdate) onPriceUpdate(newPrice);
    }, 1000);
    return () => clearInterval(interval);
  }, [externalPrice, initialPrice, onPriceUpdate]);

  // Resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Draw chart line on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { width, height } = dimensions;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const now = Math.floor(Date.now() / 1000);
      const history = priceHistoryRef.current;
      const visiblePoints = history.filter(p => p.time >= now - TIME_WINDOW);
      if (visiblePoints.length < 2) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const cRight = width - RIGHT_MARGIN;
      const cBottom = height - BOTTOM_MARGIN;
      const timeToX = (t: number) => 0 + cRight * (1 - (now - t) / TIME_WINDOW);

      // Area fill under line
      ctx.save();
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < visiblePoints.length; i++) {
        const x = timeToX(visiblePoints[i].time);
        const y = priceToY(visiblePoints[i].price);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      const lastX = timeToX(visiblePoints[visiblePoints.length - 1].time);
      ctx.lineTo(lastX, cBottom);
      ctx.lineTo(timeToX(visiblePoints[0].time), cBottom);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, cBottom);
      grad.addColorStop(0, 'rgba(245,158,11,0.08)');
      grad.addColorStop(1, 'rgba(245,158,11,0)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      // Build line path helper
      const buildLine = () => {
        ctx.beginPath();
        let s = false;
        for (let i = 0; i < visiblePoints.length; i++) {
          const x = timeToX(visiblePoints[i].time);
          const y = priceToY(visiblePoints[i].price);
          if (!s) { ctx.moveTo(x, y); s = true; }
          else ctx.lineTo(x, y);
        }
      };

      // Glow
      ctx.save();
      ctx.shadowColor = 'rgba(245,158,11,0.8)';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = 'rgba(245,158,11,0.3)';
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      buildLine();
      ctx.stroke();
      ctx.restore();

      // Main line
      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(245,158,11,0.5)';
      ctx.shadowBlur = 8;
      buildLine();
      ctx.stroke();
      ctx.restore();

      // Current price dashed horizontal line
      const last = visiblePoints[visiblePoints.length - 1];
      const dx = timeToX(last.time);
      const dy = priceToY(last.price);

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(245,158,11,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(cRight, dy);
      ctx.stroke();
      ctx.restore();

      // Dot
      ctx.save();
      ctx.shadowColor = 'rgba(245,158,11,0.9)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(dx, dy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(dx, dy, 3, 0, Math.PI * 2);
      ctx.fill();

      // X-axis time labels (внизу фрейм времени)
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      for (let s = 0; s <= TIME_WINDOW; s += 5) {
        const t = now - (TIME_WINDOW - s);
        const x = timeToX(t);
        if (x >= 0 && x <= cRight) {
          ctx.fillText(formatTime(t), x, height - 8);
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [dimensions, priceToY]);

  // Handle zone click from mouse position
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (roundState !== 'betting') return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.clientY - rect.top;
    // Find which zone this Y falls in
    for (let i = 0; i < zones.length; i++) {
      const zt = priceToY(zones[i].priceTop);
      const zb = priceToY(zones[i].priceBottom);
      if (y >= zt && y <= zb) {
        onSelectZone(selectedZone === i ? null : i);
        return;
      }
    }
  }, [zones, priceToY, roundState, selectedZone, onSelectZone]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.clientY - rect.top;
    for (let i = 0; i < zones.length; i++) {
      const zt = priceToY(zones[i].priceTop);
      const zb = priceToY(zones[i].priceBottom);
      if (y >= zt && y <= zb) {
        setHoveredZone(i);
        return;
      }
    }
    setHoveredZone(null);
  }, [zones, priceToY]);

  const delta = actualPrice - roundStartPrice;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 cursor-crosshair"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredZone(null)}
    >
      {/* Zone bands as background - z-index 10 */}
      {zones.map((zone, i) => {
        const top = priceToY(zone.priceTop);
        const bottom = priceToY(zone.priceBottom);
        const h = bottom - top;
        if (h <= 0) return null;

        const { mult, color } = getMultiplier(zone.distance);
        const isWin = roundState === 'resolved' && winningZoneBottom === zone.priceBottom;
        const isSelected = selectedZone === i;
        const isHovered = hoveredZone === i;
        const isAbove = zone.priceBottom >= actualPrice;

        let bg: string;
        let borderColor: string;

        if (isWin) {
          bg = 'rgba(16,185,129,0.2)';
          borderColor = 'rgba(16,185,129,0.5)';
        } else if (isSelected) {
          bg = 'rgba(124,58,237,0.2)';
          borderColor = 'rgba(124,58,237,0.5)';
        } else if (zone.isCurrent) {
          bg = isHovered ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.04)';
          borderColor = 'rgba(245,158,11,0.25)';
        } else if (isHovered) {
          bg = isAbove ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)';
          borderColor = isAbove ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)';
        } else {
          bg = 'transparent';
          borderColor = 'rgba(255,255,255,0.03)';
        }

        return (
          <div
            key={i}
            className="absolute left-0 transition-colors duration-75"
            style={{
              top,
              height: h,
              right: RIGHT_MARGIN,
              zIndex: 10,
              background: bg,
              borderTop: `1px solid ${borderColor}`,
              borderBottom: `1px solid ${borderColor}`,
            }}
          >
            {/* Multiplier label - only show if zone is tall enough */}
            {h > 12 && (
              <div
                className="absolute right-2 top-1/2 -translate-y-1/2 font-mono font-bold"
                style={{
                  fontSize: h > 20 ? 11 : 9,
                  color: isWin ? '#10B981' : color,
                  opacity: isHovered || isSelected || zone.isCurrent ? 0.9 : 0.35,
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                  zIndex: 30,
                  transition: 'opacity 0.1s',
                }}
              >
                {isWin ? 'WIN' : `${mult}×`}
              </div>
            )}

            {/* Direction indicator on hover */}
            {h > 12 && (isHovered || isSelected) && (
              <div
                className="absolute left-2 top-1/2 -translate-y-1/2 font-mono font-bold text-[9px]"
                style={{
                  color: isAbove ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)',
                  zIndex: 30,
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                }}
              >
                {isAbove ? '↑ UP' : '↓ DOWN'}
              </div>
            )}
          </div>
        );
      })}

      {/* Chart canvas - z-index 20 */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ zIndex: 20, pointerEvents: 'none' }}
      />

      {/* Right Y-axis price labels */}
      <div
        className="absolute top-0 right-0 flex flex-col"
        style={{
          width: RIGHT_MARGIN,
          bottom: BOTTOM_MARGIN,
          background: 'rgba(8,11,20,0.9)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          zIndex: 35,
          pointerEvents: 'none',
        }}
      >
        {zones.filter((_, i) => i % 2 === 0).map((zone) => {
          const y = priceToY(zone.priceBottom);
          const isCurrent = zone.isCurrent;
          return (
            <div
              key={zone.priceBottom}
              className="absolute font-mono text-right pr-1"
              style={{
                top: y - 7,
                right: 0,
                width: RIGHT_MARGIN,
                fontSize: isCurrent ? '0.65rem' : '0.6rem',
                color: isCurrent ? '#000' : 'rgba(255,255,255,0.4)',
                fontWeight: isCurrent ? 700 : 400,
                transition: 'top 0.3s ease',
              }}
            >
              {isCurrent ? (
                <span className="inline-block px-1 rounded" style={{ background: '#F59E0B', color: '#000' }}>
                  ${zone.priceBottom.toFixed(2)}
                </span>
              ) : (
                `$${zone.priceBottom.toFixed(2)}`
              )}
            </div>
          );
        })}

        {/* Current price label that moves */}
        <div
          className="absolute font-mono font-bold text-right pr-1"
          style={{
            top: priceToY(actualPrice) - 8,
            right: 0,
            width: RIGHT_MARGIN,
            fontSize: '0.65rem',
            transition: 'top 0.3s ease',
            zIndex: 36,
          }}
        >
          <span className="inline-block px-1 rounded" style={{ background: '#F59E0B', color: '#000', padding: '1px 3px', borderRadius: 3 }}>
            ${actualPrice.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Top info overlay */}
      <div
        className="absolute left-0 right-0 flex items-center gap-4 px-3 py-1.5"
        style={{
          top: 0,
          zIndex: 40,
          background: 'linear-gradient(180deg, rgba(8,11,20,0.9) 0%, rgba(8,11,20,0.5) 70%, transparent 100%)',
          pointerEvents: 'none',
        }}
      >
        <div>
          <span className="text-[9px] font-mono block" style={{ color: 'rgba(255,255,255,0.4)' }}>OPEN</span>
          <span className="text-sm font-bold font-mono text-foreground">${roundStartPrice.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-[9px] font-mono block" style={{ color: 'rgba(255,255,255,0.4)' }}>PRICE</span>
          <span className="text-sm font-bold font-mono text-foreground">${actualPrice.toFixed(2)}</span>
          <span
            className="ml-1.5 text-xs font-mono font-semibold"
            style={{ color: delta >= 0 ? '#10B981' : '#EF4444' }}
          >
            {delta >= 0 ? '▲' : '▼'} {delta >= 0 ? '+' : ''}${delta.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
