import { useEffect, useRef } from 'react';
import { createChart, IChartApi, AreaSeries, ISeriesApi, Time } from 'lightweight-charts';
import { PricePoint } from '../hooks/usePriceData';

interface CandlestickChartProps {
  priceHistory?: PricePoint[];
  currentPrice?: number;
}

export default function CandlestickChart({ priceHistory = [], currentPrice = 0 }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    let chart: IChartApi;
    try {
      chart = createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        layout: {
          background: { color: '#080B14' },
          textColor: 'rgba(255,255,255,0.5)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.03)' },
          horzLines: { color: 'rgba(255,255,255,0.03)' },
        },
        rightPriceScale: {
          borderColor: 'rgba(255,255,255,0.05)',
          scaleMargins: { top: 0.05, bottom: 0.05 },
        },
        timeScale: {
          borderColor: 'rgba(255,255,255,0.05)',
          timeVisible: true,
          secondsVisible: false,
        },
        crosshair: {
          vertLine: { color: 'rgba(255,255,255,0.15)', width: 1, style: 3 },
          horzLine: { color: 'rgba(255,255,255,0.15)', width: 1, style: 3 },
        },
      });
    } catch (e) {
      console.error('[CandlestickChart] createChart error:', e);
      return;
    }

    let series: ISeriesApi<'Area'>;
    try {
      series = chart.addSeries(AreaSeries, {
        lineColor: '#06B6D4',
        lineWidth: 2,
        topColor: 'rgba(6,182,212,0.12)',
        bottomColor: 'rgba(6,182,212,0)',
        crosshairMarkerBackgroundColor: '#06B6D4',
      });
    } catch (e) {
      console.error('[CandlestickChart] addSeries error:', e);
      chart.remove();
      return;
    }

    seriesRef.current = series;
    chartRef.current = chart;

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartRef.current) {
        chartRef.current.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      try { chart.remove(); } catch { /* ignore */ }
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update series data when history changes
  useEffect(() => {
    if (!seriesRef.current || priceHistory.length === 0) return;
    try {
      const data = priceHistory.map(p => ({
        time: p.time as Time,
        value: p.value,
      }));
      seriesRef.current.setData(data);
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    } catch (e) {
      console.error('[CandlestickChart] setData error:', e);
    }
  }, [priceHistory]);

  // Update latest price point
  useEffect(() => {
    if (!seriesRef.current || currentPrice <= 0 || priceHistory.length === 0) return;
    try {
      const lastPoint = priceHistory[priceHistory.length - 1];
      seriesRef.current.update({
        time: lastPoint.time as Time,
        value: currentPrice,
      });
    } catch { /* ignore */ }
  }, [currentPrice, priceHistory]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ zIndex: 0 }}
    />
  );
}
