# Phase 6 Report — Frontend Live Data & Resolution

**Date**: 2026-02-21  
**Status**: ✅ Completed

---

## Что сделано

### Фича 1: Oracle Price Sparkline

**Новый файл**: [`oracle_bet/app/src/components/PriceSparkline.tsx`](../app/src/components/PriceSparkline.tsx)

- SVG-компонент минималистичного sparkline по массиву цен
- Зелёный цвет линии если последняя цена ≥ первой, красный — если меньше
- Пропсы: `prices: number[]`, `width?: number` (default 120), `height?: number` (default 32)
- Padding 2px для корректного отображения крайних точек

**Изменён файл**: [`oracle_bet/app/src/components/LivePriceWidget.tsx`](../app/src/components/LivePriceWidget.tsx)

- Добавлен state `priceHistory: number[]` (max 50 точек)
- `useEffect` накапливает новые цены от `usePythPrice` при каждом обновлении `price`
- `<PriceSparkline prices={priceHistory} width={120} height={32} />` рендерится рядом с ценой

---

### Фича 2: Countdown Timer в MarketCard

**Новый файл**: [`oracle_bet/app/src/hooks/useCountdown.ts`](../app/src/hooks/useCountdown.ts)

- Принимает `resolutionTime: number` (unix timestamp в секундах)
- Обновляется каждую секунду через `setInterval`
- Возвращает строку:
  - `"HH:MM:SS"` если > 1 часа
  - `"MM:SS"` если < 1 часа
  - `"Истёк"` если время прошло

**Изменён файл**: [`oracle_bet/app/src/components/MarketCard.tsx`](../app/src/components/MarketCard.tsx)

- Отображает `⏰ До резолюции: {countdown}` под заголовком маркета
- CSS-класс `.market-countdown.expired` для истёкшего состояния

---

### Фича 3: useResolveMarket + кнопка Resolve

**Новый файл**: [`oracle_bet/app/src/hooks/useResolveMarket.ts`](../app/src/hooks/useResolveMarket.ts)

- Использует ER RPC (`ER_RPC` из `constants.ts`) для отправки `resolve_market` инструкции
- `skipPreflight: true` обязателен для ER
- После resolve — polling L1 каждые 2s, max 60s до `status === Resolved`
- Возвращает `{ resolve, isLoading, error }`

**В MarketCard.tsx**:

- Кнопка **"Resolve Market"** (`.btn-resolve`) показывается когда:
  - `countdown === "Истёк"` И
  - `market.status !== "Resolved"` И `market.status !== "Cancelled"` И
  - `publicKey` (кошелёк подключён)
- При resolving показывается `<LoadingSpinner message="Resolving..." />`
- После resolve — отображается блок `<div className="resolve-result">✅ YES wins! / ✅ NO wins!</div>`

---

### Фича 4: Live Market State Subscription (polling odds)

**Изменён файл**: [`oracle_bet/app/src/hooks/useMarkets.ts`](../app/src/hooks/useMarkets.ts)

- В `useEffect` добавлен `setInterval(() => fetchMarkets(), 5_000)`
- Cleanup через `clearInterval` в return функции `useEffect`
- Обновляет `totalYes`, `totalNo`, `betsCount` каждые 5 секунд в реальном времени

---

### CSS стили

**Изменён файл**: [`oracle_bet/app/src/styles/index.css`](../app/src/styles/index.css)

Добавлены стили (Phase 6 секция):
- `.price-sparkline` — inline-block, vertical-align middle
- `.market-countdown` / `.market-countdown.expired` — серый/янтарный цвет
- `.btn-resolve` — янтарный градиент, cursor pointer, width 100%
- `.resolve-result` — зелёная рамка, зелёный текст, background с opacity

---

## Изменённые файлы

| Файл | Тип | Описание |
|------|-----|----------|
| `app/src/components/PriceSparkline.tsx` | СОЗДАН | SVG sparkline компонент |
| `app/src/hooks/useCountdown.ts` | СОЗДАН | Хук обратного отсчёта |
| `app/src/hooks/useResolveMarket.ts` | СОЗДАН | Хук resolve через ER RPC |
| `app/src/components/LivePriceWidget.tsx` | ИЗМЕНЁН | priceHistory + PriceSparkline |
| `app/src/components/MarketCard.tsx` | ИЗМЕНЁН | countdown + resolve button + result |
| `app/src/hooks/useMarkets.ts` | ИЗМЕНЁН | polling каждые 5s |
| `app/src/styles/index.css` | ИЗМЕНЁН | новые стили Phase 6 |
