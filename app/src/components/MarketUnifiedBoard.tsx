import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface PricePoint {
  time: number;
  price: number;
}

export interface MarketZone {
  priceBottom: number;
  priceTop: number;
  distance: number;
  isCurrent: boolean;
}

export interface SelectedBet {
  index: number;
  direction: 'UP' | 'DOWN';
  priceBottom: number;
  priceTop: number;
  distance: number;
}

interface MarketUnifiedBoardProps {
  currentPrice: number;
  onPriceUpdate: (price: number) => void;
  initialPrice: number;
  roundStartPrice: number;
  externalPrice?: number;
  selectedBet: SelectedBet | null;
  onSelectBet: (selection: SelectedBet | null) => void;
  roundState: 'betting' | 'resolved';
  winningZoneBottom: number | null;
  isMobile?: boolean;
}

export const MARKET_ZONE_STEP = 0.1;
const ZONE_COUNT = 18;
const TIME_WINDOW = 30;
const BOTTOM_TIMELINE_HEIGHT = 34;
const TIMELINE_TICK_COUNT = 7;
const LEFT_RANGE_COL_WIDTH_DESKTOP = 64;
const LEFT_RANGE_COL_WIDTH_MOBILE = 58;
const FRAME_COL_WIDTH_DESKTOP = 34;
const FRAME_COL_WIDTH_MOBILE = 28;
const TOP_INFO_HEIGHT = 34;
const MAX_LADDER_OFFSET_STEPS = 30;

function getFrame(distance: number): { label: string; color: string } {
  if (distance <= 1) return { label: '1.2x', color: '#22D3EE' };
  if (distance <= 3) return { label: '1.45x', color: '#86EFAC' };
  if (distance <= 5) return { label: '1.78x', color: '#F59E0B' };
  if (distance <= 8) return { label: '2.3x', color: '#FB923C' };
  if (distance <= 12) return { label: '4.2x', color: '#EA580C' };
  if (distance <= 16) return { label: '9x', color: '#EF4444' };
  return { label: '20x', color: '#DC2626' };
}

export function buildMarketZones(viewCenterPrice: number, referencePrice: number = viewCenterPrice): MarketZone[] {
  const snapped = Math.floor(viewCenterPrice / MARKET_ZONE_STEP) * MARKET_ZONE_STEP;
  const half = Math.floor(ZONE_COUNT / 2);
  const zones: MarketZone[] = [];

  for (let i = half - 1; i >= -half; i--) {
    const bottom = parseFloat((snapped + i * MARKET_ZONE_STEP).toFixed(2));
    const top = parseFloat((bottom + MARKET_ZONE_STEP).toFixed(2));
    const zoneMid = (bottom + top) / 2;
    const distance = Math.round(Math.abs(zoneMid - referencePrice) / MARKET_ZONE_STEP);
    const isCurrent = referencePrice >= bottom && referencePrice < top;
    zones.push({
      priceBottom: bottom,
      priceTop: top,
      distance,
      isCurrent,
    });
  }

  return zones;
}

function getZoneDirection(zone: MarketZone, currentPrice: number, x: number, splitX: number): 'UP' | 'DOWN' {
  if (zone.priceBottom >= currentPrice) return 'UP';
  if (zone.priceTop <= currentPrice) return 'DOWN';
  return x <= splitX ? 'UP' : 'DOWN';
}

export default function MarketUnifiedBoard({
  currentPrice,
  onPriceUpdate,
  initialPrice,
  roundStartPrice,
  externalPrice,
  selectedBet,
  onSelectBet,
  roundState,
  winningZoneBottom,
  isMobile = false,
}: MarketUnifiedBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<PricePoint[]>([]);
  const animFrameRef = useRef<number>(0);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [internalPrice, setInternalPrice] = useState(initialPrice);
  const [hoveredZone, setHoveredZone] = useState<number | null>(null);
  const [timelineNow, setTimelineNow] = useState(Math.floor(Date.now() / 1000));
  const [ladderOffsetSteps, setLadderOffsetSteps] = useState(0);
  const touchYRef = useRef<number | null>(null);

  const effectivePrice = externalPrice && externalPrice > 0 ? externalPrice : internalPrice;
  const viewCenterPrice = effectivePrice + ladderOffsetSteps * MARKET_ZONE_STEP;
  const zones = useMemo(() => buildMarketZones(viewCenterPrice, effectivePrice), [viewCenterPrice, effectivePrice]);

  const leftRangeColWidth = isMobile ? LEFT_RANGE_COL_WIDTH_MOBILE : LEFT_RANGE_COL_WIDTH_DESKTOP;
  const frameColWidth = isMobile ? FRAME_COL_WIDTH_MOBILE : FRAME_COL_WIDTH_DESKTOP;
  const rightMargin = frameColWidth + 6;

  const chartLeft = leftRangeColWidth;
  const chartRight = Math.max(40, dimensions.width - rightMargin);
  const chartTop = 0;
  const chartBottom = Math.max(40, dimensions.height - BOTTOM_TIMELINE_HEIGHT);
  const chartHeight = Math.max(1, chartBottom - chartTop);
  const centerY = chartTop + chartHeight / 2;
  const pxPerZoneStep = chartHeight / ZONE_COUNT;
  const splitX = chartLeft + (chartRight - chartLeft) / 2;

  const priceToY = useCallback(
    (price: number) => centerY - ((price - viewCenterPrice) / MARKET_ZONE_STEP) * pxPerZoneStep,
    [centerY, viewCenterPrice, pxPerZoneStep],
  );

  const shiftLadder = useCallback((deltaSteps: number) => {
    setLadderOffsetSteps((prev) => {
      const next = prev + deltaSteps;
      if (next > MAX_LADDER_OFFSET_STEPS) return MAX_LADDER_OFFSET_STEPS;
      if (next < -MAX_LADDER_OFFSET_STEPS) return -MAX_LADDER_OFFSET_STEPS;
      return next;
    });
  }, []);

  const timelineLabels = useMemo(() => {
    const step = TIME_WINDOW / Math.max(1, TIMELINE_TICK_COUNT - 1);
    const labels: string[] = [];
    for (let i = 0; i < TIMELINE_TICK_COUNT; i++) {
      const ts = Math.floor(timelineNow - TIME_WINDOW + i * step);
      labels.push(
        new Date(ts * 1000).toLocaleTimeString('en-US', {
          hour12: true,
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    }
    return labels;
  }, [timelineNow]);

  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    let seedPrice = initialPrice - 1;
    const history: PricePoint[] = [];
    for (let i = TIME_WINDOW + 10; i >= 0; i--) {
      seedPrice += (Math.random() - 0.48) * 0.15;
      seedPrice = Math.max(initialPrice - 3, Math.min(initialPrice + 3, seedPrice));
      history.push({ time: now - i, price: parseFloat(seedPrice.toFixed(2)) });
    }
    history[history.length - 1].price = initialPrice;
    historyRef.current = history;
  }, [initialPrice]);

  useEffect(() => {
    if (!externalPrice || externalPrice <= 0) return;
    const now = Math.floor(Date.now() / 1000);
    const history = historyRef.current;
    const last = history[history.length - 1];
    if (!last || last.time !== now || Math.abs(last.price - externalPrice) > 0.0001) {
      history.push({ time: now, price: externalPrice });
      const cutoff = now - 60;
      while (history.length > 0 && history[0].time < cutoff) history.shift();
    }
    setInternalPrice(externalPrice);
    setTimelineNow(now);
    onPriceUpdate(externalPrice);
  }, [externalPrice, onPriceUpdate]);

  useEffect(() => {
    if (externalPrice && externalPrice > 0) return;

    const interval = setInterval(() => {
      const history = historyRef.current;
      const lastPrice = history.length > 0 ? history[history.length - 1].price : initialPrice;
      const nextPrice = parseFloat((lastPrice + (Math.random() - 0.5) * 0.12).toFixed(2));
      const now = Math.floor(Date.now() / 1000);

      history.push({ time: now, price: nextPrice });
      const cutoff = now - 60;
      while (history.length > 0 && history[0].time < cutoff) history.shift();

      setInternalPrice(nextPrice);
      setTimelineNow(now);
      onPriceUpdate(nextPrice);
    }, 1000);

    return () => clearInterval(interval);
  }, [externalPrice, initialPrice, onPriceUpdate]);

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimelineNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (roundState === 'resolved') {
      setLadderOffsetSteps(0);
    }
  }, [roundState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { width, height } = dimensions;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const now = Math.floor(Date.now() / 1000);
      const history = historyRef.current;
      const visiblePoints = history.filter((p) => p.time >= now - TIME_WINDOW);
      if (visiblePoints.length < 2) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const timeToX = (t: number) => chartLeft + (chartRight - chartLeft) * (1 - (now - t) / TIME_WINDOW);

      const currentBottom = Math.floor(effectivePrice / MARKET_ZONE_STEP) * MARKET_ZONE_STEP;
      const currentTop = currentBottom + MARKET_ZONE_STEP;
      const currentYTop = priceToY(currentTop);
      const currentYBottom = priceToY(currentBottom);

      ctx.fillStyle = 'rgba(245,158,11,0.08)';
      ctx.fillRect(chartLeft, currentYTop, chartRight - chartLeft, Math.max(1, currentYBottom - currentYTop));

      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (const zone of zones) {
        const y = priceToY(zone.priceBottom);
        ctx.beginPath();
        ctx.moveTo(chartLeft, y);
        ctx.lineTo(chartRight, y);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.moveTo(chartLeft, chartTop + TOP_INFO_HEIGHT);
      ctx.lineTo(chartRight, chartTop + TOP_INFO_HEIGHT);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.rect(chartLeft, chartTop, chartRight - chartLeft, chartBottom - chartTop);
      ctx.clip();

      ctx.beginPath();
      let started = false;
      for (const point of visiblePoints) {
        const x = timeToX(point.time);
        const y = priceToY(point.price);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      const firstX = timeToX(visiblePoints[0].time);
      const lastX = timeToX(visiblePoints[visiblePoints.length - 1].time);
      ctx.lineTo(lastX, chartBottom);
      ctx.lineTo(firstX, chartBottom);
      ctx.closePath();
      const area = ctx.createLinearGradient(0, chartTop, 0, chartBottom);
      area.addColorStop(0, 'rgba(245,158,11,0.13)');
      area.addColorStop(1, 'rgba(245,158,11,0)');
      ctx.fillStyle = area;
      ctx.fill();

      const drawLine = () => {
        ctx.beginPath();
        let startedLine = false;
        for (const point of visiblePoints) {
          const x = timeToX(point.time);
          const y = priceToY(point.price);
          if (!startedLine) {
            ctx.moveTo(x, y);
            startedLine = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      };

      ctx.save();
      ctx.shadowColor = 'rgba(245,158,11,0.85)';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = 'rgba(245,158,11,0.45)';
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      drawLine();
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round';
      drawLine();
      ctx.stroke();
      ctx.restore();

      const last = visiblePoints[visiblePoints.length - 1];
      const xCurrent = timeToX(last.time);
      const yCurrent = priceToY(effectivePrice);

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(245,158,11,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartLeft, yCurrent);
      ctx.lineTo(chartRight, yCurrent);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.shadowColor = 'rgba(245,158,11,0.8)';
      ctx.shadowBlur = 9;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(xCurrent, yCurrent, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(xCurrent, yCurrent, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [chartBottom, chartLeft, chartRight, chartTop, dimensions, effectivePrice, priceToY, zones]);

  const findZoneIndexByY = useCallback(
    (y: number): number | null => {
      if (y > chartBottom) return null;
      for (let i = 0; i < zones.length; i++) {
        const top = priceToY(zones[i].priceTop);
        const bottom = priceToY(zones[i].priceBottom);
        if (y >= top && y <= bottom) return i;
      }
      return null;
    },
    [chartBottom, priceToY, zones],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const y = event.clientY - rect.top;
      setHoveredZone(findZoneIndexByY(y));
    },
    [findZoneIndexByY],
  );

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    shiftLadder(event.deltaY < 0 ? 1 : -1);
  }, [shiftLadder]);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    touchYRef.current = event.touches[0]?.clientY ?? null;
  }, []);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    const currentTouchY = event.touches[0]?.clientY;
    if (currentTouchY == null || touchYRef.current == null) return;

    const delta = currentTouchY - touchYRef.current;
    if (Math.abs(delta) < 18) return;

    event.preventDefault();
    shiftLadder(delta < 0 ? 1 : -1);
    touchYRef.current = currentTouchY;
  }, [shiftLadder]);

  const handleTouchEnd = useCallback(() => {
    touchYRef.current = null;
  }, []);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      if (roundState !== 'betting') return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < chartLeft || x > chartRight || y > chartBottom) return;

      const zoneIndex = findZoneIndexByY(y);
      if (zoneIndex === null) return;

      const zone = zones[zoneIndex];
      const direction = getZoneDirection(zone, effectivePrice, x, splitX);
      const isSameSelection = Boolean(
        selectedBet &&
          Math.abs(selectedBet.priceBottom - zone.priceBottom) < 0.0001 &&
          selectedBet.direction === direction,
      );

      if (isSameSelection) {
        onSelectBet(null);
        return;
      }

      onSelectBet({
        index: zoneIndex,
        direction,
        priceBottom: zone.priceBottom,
        priceTop: zone.priceTop,
        distance: zone.distance,
      });
    },
    [chartBottom, chartLeft, chartRight, effectivePrice, findZoneIndexByY, onSelectBet, roundState, selectedBet, splitX, zones],
  );

  const delta = effectivePrice - roundStartPrice;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredZone(null)}
      onClick={handleClick}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: roundState === 'betting' ? 'crosshair' : 'default', touchAction: 'none' }}
    >
      {zones.map((zone, i) => {
        const top = priceToY(zone.priceTop);
        const bottom = priceToY(zone.priceBottom);
        const height = bottom - top;
        if (height <= 0) return null;

        const relation = zone.priceBottom >= effectivePrice ? 'above' : zone.priceTop <= effectivePrice ? 'below' : 'current';
        const isWinZone = roundState === 'resolved' && winningZoneBottom === zone.priceBottom;
        const isSelected = Boolean(selectedBet && Math.abs(selectedBet.priceBottom - zone.priceBottom) < 0.0001);
        const isHovered = hoveredZone === i;

        let bg = 'transparent';
        let border = 'rgba(255,255,255,0.04)';
        if (isWinZone) {
          bg = 'rgba(16,185,129,0.24)';
          border = 'rgba(16,185,129,0.45)';
        } else if (isSelected) {
          bg = 'rgba(124,58,237,0.28)';
          border = 'rgba(124,58,237,0.55)';
        } else if (relation === 'current') {
          bg = isHovered ? 'rgba(245,158,11,0.28)' : 'rgba(245,158,11,0.16)';
          border = 'rgba(245,158,11,0.45)';
        } else if (relation === 'above') {
          bg = isHovered ? 'rgba(16,185,129,0.24)' : 'rgba(16,185,129,0.13)';
        } else {
          bg = isHovered ? 'rgba(239,68,68,0.24)' : 'rgba(239,68,68,0.13)';
        }

        return (
          <div
            key={zone.priceBottom}
            className="absolute left-0 transition-colors duration-100"
            style={{
              top,
              height,
              left: chartLeft,
              right: rightMargin,
              background: bg,
              borderTop: `1px solid ${border}`,
              borderBottom: `1px solid ${border}`,
              zIndex: 8,
            }}
          />
        );
      })}

      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ pointerEvents: 'none', zIndex: 20 }}
      />

      <div
        className="absolute top-0 left-0"
        style={{
          width: leftRangeColWidth,
          height: chartBottom,
          background: 'rgba(8,11,20,0.9)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          zIndex: 26,
          pointerEvents: 'none',
        }}
      >
        {zones.map((zone) => {
          const y = (priceToY(zone.priceTop) + priceToY(zone.priceBottom)) / 2;
          const isCurrent = zone.isCurrent;
          return (
            <div
              key={`left-range-${zone.priceBottom}`}
              className="absolute font-mono text-right pr-1"
              style={{
                top: y - 7,
                right: 0,
                width: leftRangeColWidth,
                fontSize: isMobile ? '0.5rem' : '0.56rem',
                color: isCurrent ? '#111827' : 'rgba(255,255,255,0.6)',
                fontWeight: isCurrent ? 700 : 500,
                lineHeight: 1,
              }}
            >
              {isCurrent ? (
                <span
                  className="inline-block px-1 rounded"
                  style={{ background: '#F59E0B', color: '#000', padding: '1px 3px', borderRadius: 3 }}
                >
                  ${zone.priceBottom.toFixed(2)}-${zone.priceTop.toFixed(2)}
                </span>
              ) : (
                `$${zone.priceBottom.toFixed(2)}-$${zone.priceTop.toFixed(2)}`
              )}
            </div>
          );
        })}
      </div>

      <div
        className="absolute top-0 right-0"
        style={{
          width: rightMargin,
          height: chartBottom,
          background: 'rgba(8,11,20,0.9)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          zIndex: 26,
          pointerEvents: 'none',
        }}
      >
        {zones.map((zone) => {
          const y = (priceToY(zone.priceTop) + priceToY(zone.priceBottom)) / 2;
          const frame = getFrame(zone.distance);
          return (
            <div key={`frame-${zone.priceBottom}`}>
              <div
                className="absolute font-mono text-right"
                style={{
                  top: y - 6,
                  right: 4,
                  width: frameColWidth - 8,
                  fontSize: isMobile ? '0.55rem' : '0.62rem',
                  color: frame.color,
                  opacity: 0.85,
                  fontWeight: 700,
                }}
              >
                {frame.label}
              </div>
            </div>
          );
        })}

        <div
          className="absolute font-mono font-bold text-right"
          style={{
            top: priceToY(effectivePrice) - 8,
            right: 2,
            fontSize: isMobile ? '0.62rem' : '0.7rem',
            zIndex: 28,
          }}
        >
          <span
            className="inline-block px-1 rounded"
            style={{ background: '#F59E0B', color: '#000', padding: '1px 4px', borderRadius: 3 }}
          >
            ${effectivePrice.toFixed(2)}
          </span>
        </div>
      </div>

      <div
        className="absolute left-0 right-0 flex items-start gap-4 px-3 py-1.5"
        style={{
          top: 0,
          zIndex: 30,
          background: 'linear-gradient(180deg, rgba(8,11,20,0.94) 0%, rgba(8,11,20,0.45) 72%, transparent 100%)',
          pointerEvents: 'none',
        }}
      >
        <div>
          <span className="text-[9px] font-mono block" style={{ color: 'rgba(255,255,255,0.42)' }}>
            OPEN
          </span>
          <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold font-mono text-foreground`}>
            ${roundStartPrice.toFixed(2)}
          </span>
        </div>
        <div>
          <span className="text-[9px] font-mono block" style={{ color: 'rgba(255,255,255,0.42)' }}>
            PRICE
          </span>
          <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold font-mono text-foreground`}>
            ${effectivePrice.toFixed(2)}
          </span>
          <span
            className={`ml-1 ${isMobile ? 'text-[10px]' : 'text-xs'} font-mono font-semibold`}
            style={{ color: delta >= 0 ? '#10B981' : '#EF4444' }}
          >
            {delta >= 0 ? '+' : ''}${delta.toFixed(2)}
          </span>
        </div>
      </div>

      <div
        className="absolute left-0 right-0 flex items-center"
        style={{
          bottom: 0,
          height: BOTTOM_TIMELINE_HEIGHT,
          zIndex: 24,
          background: 'linear-gradient(180deg, rgba(12,16,30,0.9) 0%, rgba(8,11,20,0.98) 100%)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingLeft: chartLeft + 8,
          paddingRight: rightMargin + 8,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
          pointerEvents: 'none',
        }}
      >
        <div className="w-full flex items-center justify-between">
          {timelineLabels.map((label, idx) => (
            <span
              key={`${label}-${idx}`}
              className="font-mono"
              style={{
                fontSize: isMobile ? 10 : 11,
                color: 'rgba(148,163,184,0.78)',
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
