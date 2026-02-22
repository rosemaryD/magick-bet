import { useEffect, useMemo, useState } from 'react';
import { ZONE_STEP, getMultiplier, getProbability } from '../hooks/useZones';
import { useRef } from 'react';

export const COLS = 2;
const COL_HEADERS = ['UP', 'DOWN'];
const HEADER_HEIGHT = 32;
const RULE_HINT_HEIGHT = 18;
const ZONE_COUNT = 40;
const PRICE_COL_WIDTH = 72;
const FRAME_COL_WIDTH = 44;
const ROW_HEIGHT = 48;

function getMultiplierColor(distance: number): string {
  if (distance === 0) return '#F59E0B';
  if (distance <= 1) return '#22D3EE';
  if (distance <= 3) return '#86EFAC';
  if (distance <= 5) return '#FB923C';
  return '#C084FC';
}

function formatMult(mult: number): string {
  if (mult < 10) return `${mult}x`;
  return `${Math.round(mult)}x`;
}

function getCellBg(
  distance: number,
  col: number,
  isCurrent: boolean,
  isSelected: boolean,
  isHovered: boolean,
  isWinZone: boolean,
  isDisabled: boolean,
): { bg: string; border: string } {
  if (isDisabled) {
    return {
      bg: 'rgba(148,163,184,0.06)',
      border: '1px dashed rgba(148,163,184,0.25)',
    };
  }

  if (isWinZone) {
    return {
      bg: 'rgba(16,185,129,0.2)',
      border: '1px solid rgba(16,185,129,0.5)',
    };
  }

  if (isSelected) {
    return {
      bg: 'rgba(124,58,237,0.3)',
      border: '1px solid rgba(124,58,237,0.6)',
    };
  }

  if (isCurrent) {
    return {
      bg: isHovered ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.12)',
      border: '1px solid rgba(245,158,11,0.6)',
    };
  }

  const isUp = col === 0;

  if (distance === 1) {
    const base = isUp ? 'rgba(16,185,129,' : 'rgba(239,68,68,';
    const alpha = isHovered ? 0.25 : 0.15;
    return {
      bg: `${base}${alpha})`,
      border: isHovered ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.08)',
    };
  }

  if (distance <= 3) {
    const base = isUp ? 'rgba(16,185,129,' : 'rgba(239,68,68,';
    const alpha = isHovered ? 0.3 : 0.2;
    return {
      bg: `${base}${alpha})`,
      border: isHovered ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.08)',
    };
  }

  if (distance <= 5) {
    const base = isUp ? 'rgba(16,185,129,' : 'rgba(239,68,68,';
    const alpha = isHovered ? 0.38 : 0.3;
    return {
      bg: `${base}${alpha})`,
      border: isHovered ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.1)',
    };
  }

  const alpha = isHovered ? 0.35 : 0.2;
  return {
    bg: `rgba(168,85,247,${alpha})`,
    border: isHovered ? '1px solid rgba(192,132,252,0.5)' : '1px solid rgba(168,85,247,0.3)',
  };
}

export interface ZoneRow {
  label: string;
  priceBottom: number;
  priceTop: number;
  distance: number;
  isCurrent: boolean;
}

function buildZones(currentPrice: number): ZoneRow[] {
  const snapped = Math.floor(currentPrice / ZONE_STEP) * ZONE_STEP;
  const half = Math.floor(ZONE_COUNT / 2);
  const zones: ZoneRow[] = [];

  for (let i = half - 1; i >= -half; i--) {
    const bottom = parseFloat((snapped + i * ZONE_STEP).toFixed(2));
    const top = parseFloat((snapped + (i + 1) * ZONE_STEP).toFixed(2));
    const isCurrent = currentPrice >= bottom && currentPrice < top;
    const distance = Math.abs(i);

    zones.push({
      label: `$${bottom.toFixed(2)}-$${top.toFixed(2)}`,
      priceBottom: bottom,
      priceTop: top,
      distance,
      isCurrent,
    });
  }

  return zones;
}

type ZoneRelation = 'above' | 'below' | 'current';

function getZoneRelation(zone: ZoneRow, currentPrice: number): ZoneRelation {
  if (zone.priceBottom >= currentPrice) return 'above';
  if (zone.priceTop <= currentPrice) return 'below';
  return 'current';
}

function isCellEnabled(
  zone: ZoneRow,
  col: number,
  currentPrice: number,
  roundState: 'betting' | 'resolved',
): boolean {
  if (roundState !== 'betting') return false;

  const relation = getZoneRelation(zone, currentPrice);
  if (relation === 'above') return col === 0;
  if (relation === 'below') return col === 1;
  return true;
}

interface BetGridProps {
  selectedCell: number | null;
  onSelectCell: (index: number | null) => void;
  currentPrice: number;
  roundState: 'betting' | 'resolved';
  winningZoneBottom: number | null;
}

export default function BetGrid({
  selectedCell,
  onSelectCell,
  currentPrice,
  roundState,
  winningZoneBottom,
}: BetGridProps) {
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const zones = useMemo(() => buildZones(currentPrice), [currentPrice]);
  const currentRowIndex = useMemo(() => zones.findIndex((z) => z.isCurrent), [zones]);

  useEffect(() => {
    if (selectedCell === null) return;

    const row = Math.floor(selectedCell / COLS);
    const col = selectedCell % COLS;
    const zone = zones[row];

    if (!zone || !isCellEnabled(zone, col, currentPrice, roundState)) {
      onSelectCell(null);
    }
  }, [selectedCell, zones, currentPrice, roundState, onSelectCell]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || currentRowIndex < 0) return;

    const target = currentRowIndex * ROW_HEIGHT - (container.clientHeight - ROW_HEIGHT) / 2;
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    const nextScrollTop = Math.max(0, Math.min(target, maxScroll));

    container.scrollTo({ top: nextScrollTop, behavior: 'auto' });
  }, [currentRowIndex]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex shrink-0"
        style={{
          height: HEADER_HEIGHT,
          background: 'rgba(8,11,20,0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ width: PRICE_COL_WIDTH, flexShrink: 0 }} />
        {COL_HEADERS.map((header, ci) => (
          <div
            key={header}
            className="flex-1 flex items-center justify-center text-[11px] font-mono font-bold"
            style={{ color: ci === 0 ? '#10B981' : '#EF4444' }}
          >
            {ci === 0 ? 'UP ^' : 'DOWN v'}
          </div>
        ))}
        <div
          className="flex items-center justify-center text-[10px] font-mono font-bold"
          style={{ width: FRAME_COL_WIDTH, color: 'rgba(255,255,255,0.6)' }}
        >
          FRAME
        </div>
      </div>

      <div
        className="shrink-0 flex items-center justify-center text-[9px] font-mono"
        style={{
          height: RULE_HINT_HEIGHT,
          color: 'rgba(148,163,184,0.9)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(8,11,20,0.65)',
        }}
      >
        UP ABOVE CURRENT | DOWN BELOW CURRENT
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
      >
        {zones.map((zone, ri) => {
          const mult = getMultiplier(zone.distance);
          const multColor = getMultiplierColor(zone.distance);
          const prob = getProbability(zone.distance);
          const isWinZone = roundState === 'resolved' && winningZoneBottom === zone.priceBottom;

          let rowBg = 'transparent';
          let rowBorderLeft = 'none';
          if (isWinZone) {
            rowBg = 'rgba(16,185,129,0.15)';
          } else if (zone.isCurrent) {
            rowBg = 'rgba(245,158,11,0.08)';
            rowBorderLeft = '2px solid rgba(245,158,11,0.5)';
          }

          return (
            <div
              key={ri}
              className="flex"
              style={{
                height: ROW_HEIGHT,
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: rowBg,
                borderLeft: rowBorderLeft,
              }}
            >
              <div className="flex items-center justify-end pr-1.5 shrink-0" style={{ width: PRICE_COL_WIDTH }}>
                <span
                  className="font-mono leading-none"
                  style={{
                    fontSize: 10,
                    color: zone.isCurrent ? '#F59E0B' : 'rgba(255,255,255,0.85)',
                    fontWeight: zone.isCurrent ? 700 : 500,
                    textAlign: 'right',
                    lineHeight: 1.3,
                  }}
                >
                  {zone.label.replace(/\$/g, '')}
                  {zone.isCurrent && <>*</>}
                </span>
              </div>

              {[0, 1].map((col) => {
                const index = ri * COLS + col;
                const enabled = isCellEnabled(zone, col, currentPrice, roundState);
                const isDisabled = !enabled;
                const isSelected = enabled && selectedCell === index;
                const isHovered = enabled && hoveredCell === index;

                const { bg, border } = getCellBg(
                  zone.distance,
                  col,
                  zone.isCurrent,
                  isSelected,
                  isHovered,
                  isWinZone,
                  isDisabled,
                );

                const multDisplayColor = isDisabled
                  ? 'rgba(148,163,184,0.85)'
                  : isWinZone
                    ? '#10B981'
                    : multColor;

                return (
                  <div
                    key={col}
                    className={`flex-1 flex flex-col items-center justify-center transition-all duration-100 mx-0.5 my-0.5 rounded-lg gap-0.5 ${enabled ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                    style={{
                      background: bg,
                      border,
                      backdropFilter: 'blur(6px)',
                      opacity: isDisabled ? 0.55 : 1,
                      ...(enabled && isHovered && !isSelected ? { transform: 'scale(1.02)' } : {}),
                    }}
                    onMouseEnter={() => enabled && setHoveredCell(index)}
                    onMouseLeave={() => enabled && setHoveredCell(null)}
                    onClick={() => enabled && onSelectCell(isSelected ? null : index)}
                  >
                    <span
                      className="font-bold font-mono leading-none"
                      style={{
                        fontSize: 'clamp(12px, 1.5vw, 15px)',
                        color: multDisplayColor,
                        textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                      }}
                    >
                      {isDisabled ? '-' : isWinZone ? 'WIN' : formatMult(mult)}
                    </span>

                    {!isWinZone && !isDisabled && (
                      <span
                        className="font-mono leading-none"
                        style={{
                          fontSize: 9,
                          color: multDisplayColor,
                          opacity: 0.55,
                        }}
                      >
                        {prob}
                      </span>
                    )}
                  </div>
                );
              })}

              <div
                className="shrink-0 flex flex-col items-end justify-center pr-1 font-mono"
                style={{
                  width: FRAME_COL_WIDTH,
                  borderLeft: '1px solid rgba(255,255,255,0.05)',
                  background: zone.isCurrent ? 'rgba(245,158,11,0.05)' : 'rgba(8,11,20,0.45)',
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: isWinZone ? '#10B981' : multColor,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {isWinZone ? 'WIN' : formatMult(mult)}
                </span>
                {!isWinZone && (
                  <span
                    style={{
                      fontSize: 8,
                      color: 'rgba(255,255,255,0.5)',
                      lineHeight: 1.1,
                      marginTop: 2,
                    }}
                  >
                    {prob}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
