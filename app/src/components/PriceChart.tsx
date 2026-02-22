import { useEffect, useMemo, useRef, useState } from 'react';

interface PricePoint {
  time: number;
  price: number;
}

interface PriceChartProps {
  onPriceUpdate: (price: number) => void;
  initialPrice: number;
  roundStartPrice?: number;
  externalPrice?: number;
  isMobile?: boolean;
}

const TIME_WINDOW = 30;
const PRICE_STEP = 0.1;
const FIXED_HALF_RANGE = 1.4;
const LEFT_MARGIN = 0;
const DESKTOP_PRICE_AXIS_WIDTH = 58;
const MOBILE_PRICE_AXIS_WIDTH = 52;
const DESKTOP_FRAME_AXIS_WIDTH = 32;
const MOBILE_FRAME_AXIS_WIDTH = 28;
const DESKTOP_TOP_MARGIN = 4;
const DESKTOP_BOTTOM_MARGIN = 18;

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function frameByDistance(distance: number): { label: string; color: string } {
  if (distance <= 2) return { label: '1.5x', color: '#F59E0B' };
  if (distance <= 4) return { label: '2.1x', color: '#F97316' };
  if (distance <= 7) return { label: '4.2x', color: '#EA580C' };
  if (distance <= 10) return { label: '9x', color: '#EF4444' };
  return { label: '20x', color: '#DC2626' };
}

export default function PriceChart({
  onPriceUpdate,
  initialPrice,
  roundStartPrice,
  externalPrice,
  isMobile = false,
}: PriceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const priceHistoryRef = useRef<PricePoint[]>([]);
  const animFrameRef = useRef<number>(0);
  const [dimensions, setDimensions] = useState({ width: 800, height: 120 });
  const [currentPrice, setCurrentPrice] = useState(initialPrice);

  const priceAxisWidth = isMobile ? MOBILE_PRICE_AXIS_WIDTH : DESKTOP_PRICE_AXIS_WIDTH;
  const frameAxisWidth = isMobile ? MOBILE_FRAME_AXIS_WIDTH : DESKTOP_FRAME_AXIS_WIDTH;
  const rightMargin = priceAxisWidth + frameAxisWidth;
  const topMargin = isMobile ? 2 : DESKTOP_TOP_MARGIN;
  const bottomMargin = isMobile ? 14 : DESKTOP_BOTTOM_MARGIN;
  const minPrice = currentPrice - FIXED_HALF_RANGE;
  const maxPrice = currentPrice + FIXED_HALF_RANGE;

  const chartTop = topMargin;
  const chartBottom = dimensions.height - bottomMargin;
  const chartH = Math.max(1, chartBottom - chartTop);
  const centerY = chartTop + chartH / 2;
  const totalSteps = Math.max(1, (FIXED_HALF_RANGE * 2) / PRICE_STEP);
  const pxPerStep = chartH / totalSteps;

  const priceToY = useMemo(
    () => (p: number) => centerY - ((p - currentPrice) / PRICE_STEP) * pxPerStep,
    [centerY, currentPrice, pxPerStep],
  );

  const currentZoneBottom = Math.floor(currentPrice / PRICE_STEP) * PRICE_STEP;
  const currentZoneTop = parseFloat((currentZoneBottom + PRICE_STEP).toFixed(2));

  const yLabels = useMemo(() => {
    const labels: number[] = [];
    const start = Math.ceil(minPrice / PRICE_STEP) * PRICE_STEP;
    for (let p = start; p <= maxPrice + 0.0001; p += PRICE_STEP) {
      labels.push(parseFloat(p.toFixed(2)));
    }
    return labels;
  }, [minPrice, maxPrice]);

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

  useEffect(() => {
    if (externalPrice && externalPrice > 0) {
      const now = Math.floor(Date.now() / 1000);
      const history = priceHistoryRef.current;
      history.push({ time: now, price: externalPrice });
      const cutoff = now - 60;
      while (history.length > 0 && history[0].time < cutoff) history.shift();
      setCurrentPrice(externalPrice);
      onPriceUpdate(externalPrice);
      return;
    }

    const interval = setInterval(() => {
      const history = priceHistoryRef.current;
      const lastPrice = history.length > 0 ? history[history.length - 1].price : initialPrice;
      const newPrice = parseFloat((lastPrice + (Math.random() - 0.5) * 0.12).toFixed(2));
      const now = Math.floor(Date.now() / 1000);
      history.push({ time: now, price: newPrice });
      const cutoff = now - 60;
      while (history.length > 0 && history[0].time < cutoff) history.shift();
      setCurrentPrice(newPrice);
      onPriceUpdate(newPrice);
    }, 1000);

    return () => clearInterval(interval);
  }, [externalPrice, initialPrice, onPriceUpdate]);

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
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const now = Math.floor(Date.now() / 1000);
      const history = priceHistoryRef.current;
      const visiblePoints = history.filter((p) => p.time >= now - TIME_WINDOW);
      if (visiblePoints.length < 2) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const chartLeft = LEFT_MARGIN;
      const localPriceAxisWidth = isMobile ? MOBILE_PRICE_AXIS_WIDTH : DESKTOP_PRICE_AXIS_WIDTH;
      const localFrameAxisWidth = isMobile ? MOBILE_FRAME_AXIS_WIDTH : DESKTOP_FRAME_AXIS_WIDTH;
      const localRightMargin = localPriceAxisWidth + localFrameAxisWidth;
      const chartRight = width - localRightMargin;
      const chartTop = topMargin;
      const chartBottom = height - bottomMargin;
      const chartH = Math.max(1, chartBottom - chartTop);
      const minP = currentPrice - FIXED_HALF_RANGE;
      const maxP = currentPrice + FIXED_HALF_RANGE;
      const localCenterY = chartTop + chartH / 2;
      const localTotalSteps = Math.max(1, (FIXED_HALF_RANGE * 2) / PRICE_STEP);
      const localPxPerStep = chartH / localTotalSteps;

      const priceToY = (p: number) => localCenterY - ((p - currentPrice) / PRICE_STEP) * localPxPerStep;
      const timeToX = (t: number) => chartLeft + (chartRight - chartLeft) * (1 - (now - t) / TIME_WINDOW);

      const zoneBottom = Math.floor(currentPrice / PRICE_STEP) * PRICE_STEP;
      const zoneTop = zoneBottom + PRICE_STEP;
      const zoneYTop = priceToY(zoneTop);
      const zoneYBottom = priceToY(zoneBottom);

      ctx.save();
      ctx.fillStyle = 'rgba(245,158,11,0.08)';
      ctx.fillRect(chartLeft, zoneYTop, chartRight - chartLeft, Math.max(1, zoneYBottom - zoneYTop));
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      const yStart = Math.ceil(minP / PRICE_STEP) * PRICE_STEP;
      for (let p = yStart; p <= maxP + 0.0001; p += PRICE_STEP) {
        const y = priceToY(p);
        ctx.beginPath();
        ctx.moveTo(chartLeft, y);
        ctx.lineTo(chartRight, y);
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.rect(chartLeft, chartTop, chartRight - chartLeft, chartBottom - chartTop);
      ctx.clip();

      ctx.save();
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < visiblePoints.length; i++) {
        const x = timeToX(visiblePoints[i].time);
        const y = priceToY(visiblePoints[i].price);
        if (x < chartLeft - 10) continue;
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      const lastX = timeToX(visiblePoints[visiblePoints.length - 1].time);
      ctx.lineTo(lastX, chartBottom);
      ctx.lineTo(timeToX(visiblePoints[0].time), chartBottom);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, chartTop, 0, chartBottom);
      grad.addColorStop(0, 'rgba(245,158,11,0.15)');
      grad.addColorStop(1, 'rgba(245,158,11,0)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      const buildLine = () => {
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < visiblePoints.length; i++) {
          const x = timeToX(visiblePoints[i].time);
          const y = priceToY(visiblePoints[i].price);
          if (x < chartLeft - 10) continue;
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      };

      ctx.save();
      ctx.shadowColor = 'rgba(245,158,11,0.8)';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = 'rgba(245,158,11,0.4)';
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      buildLine();
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      buildLine();
      ctx.stroke();
      ctx.restore();

      const last = visiblePoints[visiblePoints.length - 1];
      const dx = timeToX(last.time);
      const dy = localCenterY;

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(245,158,11,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartLeft, dy);
      ctx.lineTo(chartRight, dy);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.shadowColor = 'rgba(245,158,11,0.8)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(dx, dy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      for (let s = 0; s <= TIME_WINDOW; s += 5) {
        const t = now - (TIME_WINDOW - s);
        const x = timeToX(t);
        if (x >= chartLeft && x <= chartRight) {
          ctx.fillText(formatTime(t), x, height - 2);
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [bottomMargin, currentPrice, dimensions, isMobile, rightMargin, topMargin]);

  const delta = roundStartPrice ? currentPrice - roundStartPrice : 0;

  return (
    <div ref={containerRef} className="absolute inset-0" style={{ pointerEvents: 'none' }}>
      <canvas ref={canvasRef} className="absolute inset-0" style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />

      <div className={`absolute flex items-start ${isMobile ? 'gap-2' : 'gap-4'}`} style={{ top: isMobile ? 4 : 8, left: isMobile ? 8 : 12, zIndex: 30 }}>
        {roundStartPrice != null && (
          <div>
            <span className={`${isMobile ? 'text-[8px]' : 'text-[9px]'} font-mono text-muted-foreground block`}>PRICE TO BEAT</span>
            <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold text-foreground font-mono`}>${roundStartPrice.toFixed(2)}</span>
          </div>
        )}
        <div>
          <span className={`${isMobile ? 'text-[8px]' : 'text-[9px]'} font-mono text-muted-foreground block`}>CURRENT</span>
          <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold text-foreground font-mono`}>${currentPrice.toFixed(2)}</span>
          {roundStartPrice != null && (
            <span
              className={`ml-1 ${isMobile ? 'text-[10px]' : 'text-xs'} font-mono font-semibold`}
              style={{ color: delta >= 0 ? '#10B981' : '#EF4444' }}
            >
              {delta >= 0 ? '+' : ''}${delta.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      <div
        className="absolute top-0 right-0 flex flex-col"
        style={{
          width: rightMargin,
          height: '100%',
          background: 'rgba(8,11,20,0.9)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          zIndex: 25,
          pointerEvents: 'none',
        }}
      >
        {yLabels.map((p) => {
          const y = priceToY(p);
          const zoneMid = p + PRICE_STEP / 2;
          const distance = Math.round(Math.abs(zoneMid - currentPrice) / PRICE_STEP);
          const frame = frameByDistance(distance);
          const isCurrentZoneTick = Math.abs(p - currentZoneBottom) < 0.0001 || Math.abs(p - currentZoneTop) < 0.0001;
          return (
            <div key={p}>
              <div
                className="absolute font-mono text-right"
                style={{
                  top: y - 6,
                  right: priceAxisWidth + 2,
                  width: frameAxisWidth - 4,
                  fontSize: isMobile ? '0.55rem' : '0.6rem',
                  color: frame.color,
                  opacity: isCurrentZoneTick ? 1 : 0.7,
                  fontWeight: 700,
                  transition: 'top 0.3s ease',
                }}
              >
                {frame.label}
              </div>
              <div
                className="absolute font-mono text-right pr-1"
                style={{
                  top: y - 7,
                  right: 0,
                  width: priceAxisWidth,
                  fontSize: isMobile ? '0.58rem' : '0.65rem',
                  color: 'rgba(255,255,255,0.5)',
                  fontWeight: 400,
                  transition: 'top 0.3s ease',
                }}
              >
                ${p.toFixed(2)}
              </div>
            </div>
          );
        })}

        <div
          className="absolute font-mono font-bold text-right pr-1"
          style={{
            top: priceToY(currentPrice) - 8,
            right: 0,
            width: priceAxisWidth,
            fontSize: isMobile ? '0.62rem' : '0.7rem',
            transition: 'top 0.3s ease',
            zIndex: 26,
            pointerEvents: 'none',
          }}
        >
          <span
            className="inline-block px-1 rounded"
            style={{ background: '#F59E0B', color: '#000', padding: '1px 4px', borderRadius: 3 }}
          >
            ${currentPrice.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
