import { useMemo } from "react";

export interface Zone {
  id: string;
  priceMin: number;
  priceMax: number;
  multiplier: number;
  isCurrentZone: boolean;
  distanceFromCurrent: number; // 0 = текущая зона, 1 = ±1, и т.д.
  label: string; // "$185.00 – $185.25"
  probability: string; // "~38%", "~18%", etc.
}

export const ZONE_STEP = 0.10;
export const TOTAL_ZONES = 30; // 15 выше + 15 ниже

// Таблица вероятностей по дистанции (для отображения в UI)
export const PROBABILITY_TABLE: Record<number, string> = {
  0: "~38%",
  1: "~18%",
  2: "~10%",
  3: "~6%",
  4: "~4%",
  5: "~2.5%",
  6: "~1.5%",
  7: "<1%",
};

// Таблица множителей по дистанции (скромные, house edge ~5–8%)
// SOL волатильность за 30 секунд: обычно ±$0.25–$1.50
export const MULTIPLIER_TABLE: Record<number, number> = {
  0: 1.10,  // текущая зона ±$0.10 — ~38%
  1: 1.20,  // ±$0.10–$0.20 — ~18%
  2: 1.32,  // ±$0.20–$0.30 — ~10%
  3: 1.45,  // ±$0.30–$0.40 — ~6%
  4: 1.60,  // ±$0.40–$0.50 — ~4%
  5: 1.78,  // ±$0.50–$0.60 — ~2.5%
  6: 2.00,  // ±$0.60–$0.70 — ~1.5%
  7: 2.30,  // ±$0.70–$0.80 — <1%
  8: 2.70,  // ±$0.80–$0.90 — <0.5%
  9: 3.20,  // ±$0.90–$1.00 — <0.3%
};

export function getMultiplier(distanceFromCurrent: number): number {
  if (distanceFromCurrent >= 10) return 4.00;
  return MULTIPLIER_TABLE[distanceFromCurrent] ?? 4.00;
}

export function getProbability(distanceFromCurrent: number): string {
  if (distanceFromCurrent >= 7) return "<1%";
  return PROBABILITY_TABLE[distanceFromCurrent] ?? "<1%";
}

function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

export function useZones(currentPrice: number): Zone[] {
  return useMemo(() => {
    if (currentPrice <= 0) return [];

    // Находим зону для текущей цены (snap к шагу $0.10)
    const currentZoneMin = Math.floor(currentPrice / ZONE_STEP) * ZONE_STEP;

    // Генерируем 30 зон: 15 выше + 15 ниже (включая текущую)
    const halfZones = Math.floor(TOTAL_ZONES / 2);

    const zones: Zone[] = [];

    for (let i = halfZones - 1; i >= -halfZones; i--) {
      const zoneMin = currentZoneMin + i * ZONE_STEP;
      const zoneMax = zoneMin + ZONE_STEP;

      // Дистанция от текущей зоны (i=0 — текущая)
      const distanceFromCurrent = Math.abs(i);
      const isCurrentZone = i === 0;

      const multiplier = getMultiplier(distanceFromCurrent);
      const probability = getProbability(distanceFromCurrent);

      const zone: Zone = {
        id: `zone_${zoneMin.toFixed(2)}`,
        priceMin: parseFloat(zoneMin.toFixed(2)),
        priceMax: parseFloat(zoneMax.toFixed(2)),
        multiplier,
        isCurrentZone,
        distanceFromCurrent,
        label: `${formatPrice(zoneMin)} – ${formatPrice(zoneMax)}`,
        probability,
      };

      zones.push(zone);
    }

    // Зоны отсортированы по убыванию цены (верхние = выше цены)
    return zones;
  }, [currentPrice]);
}
