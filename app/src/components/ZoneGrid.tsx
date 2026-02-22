import React, { useRef, useCallback } from "react";
import type { Zone } from "../hooks/useZones";

interface ZoneCellProps {
  zone: Zone;
  direction: 'up' | 'down';
  onClick: (zone: Zone, direction: 'up' | 'down') => void;
}

function ZoneCell({ zone, direction, onClick }: ZoneCellProps) {
  const isUp = direction === 'up';
  const isCurrent = zone.isCurrentZone;

  const handleClick = useCallback(() => {
    onClick(zone, direction);
  }, [zone, direction, onClick]);

  let bgColor: string;
  let borderColor: string;
  let textColor: string;

  if (isCurrent) {
    bgColor = "rgba(245,158,11,0.18)";
    borderColor = "rgba(245,158,11,0.5)";
    textColor = "#F59E0B";
  } else if (isUp) {
    bgColor = "rgba(16,185,129,0.08)";
    borderColor = "rgba(16,185,129,0.15)";
    textColor = "#10B981";
  } else {
    bgColor = "rgba(239,68,68,0.08)";
    borderColor = "rgba(239,68,68,0.15)";
    textColor = "#EF4444";
  }

  return (
    <button
      className={`zone-cell zone-cell--${direction}${isCurrent ? " zone-cell--current" : ""}`}
      onClick={handleClick}
      style={{ background: bgColor, borderColor }}
      aria-label={`${direction.toUpperCase()} bet on ${zone.label} at ${zone.multiplier}x`}
    >
      <span className="zone-cell__multiplier" style={{ color: textColor }}>
        {zone.multiplier.toFixed(1)}×
      </span>
      <span className="zone-cell__range">
        {zone.label}
      </span>
    </button>
  );
}

interface ZoneGridProps {
  zones: Zone[];
  onCellClick: (zone: Zone, direction: 'up' | 'down') => void;
  children?: React.ReactNode;
}

export function ZoneGrid({ zones, onCellClick, children }: ZoneGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  return (
    <div className="zone-grid-wrapper" ref={gridRef}>
      {/* Заголовок столбцов */}
      <div className="zone-grid-header">
        <div className="zone-grid-header__col zone-grid-header__col--up">↑ UP</div>
        <div className="zone-grid-header__col zone-grid-header__col--down">↓ DOWN</div>
      </div>

      {/* Сетка ячеек с chart overlay */}
      <div className="zone-grid">
        {/* Chart overlay — позиционируется абсолютно поверх */}
        {children}

        {/* Строки зон */}
        {zones.map((zone) => (
          <div key={zone.id} className="zone-row">
            <ZoneCell zone={zone} direction="up" onClick={onCellClick} />
            <ZoneCell zone={zone} direction="down" onClick={onCellClick} />
          </div>
        ))}
      </div>
    </div>
  );
}
