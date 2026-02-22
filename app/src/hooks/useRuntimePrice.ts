import { useEffect, useState, useRef, useMemo } from 'react';

export type PriceSource = 'pyth_ws' | 'binance_ws' | 'simulated';

export interface RuntimePriceData {
  currentPrice: number;
  source: PriceSource;
  isLive: boolean;
  degraded: boolean;
}

const DEFAULT_SIM_PRICE = 187.42;
const PYTH_WS_ENDPOINT = 'wss://pyth-lazer-0.dourolabs.app/v1/stream';
const BINANCE_WS_ENDPOINT = 'wss://stream.binance.com:9443/ws/solusdt@aggTrade';
const SOL_USD_FEED_ID = 6;

// Pyth timeout 3s
const PYTH_TIMEOUT_MS = 3000;
// Binance timeout 5s
const BINANCE_TIMEOUT_MS = 5000;

export function useRuntimePrice(): RuntimePriceData {
  const [pythPrice, setPythPrice] = useState<number | null>(null);
  const [binancePrice, setBinancePrice] = useState<number | null>(null);
  const [simulatedPrice, setSimulatedPrice] = useState<number>(DEFAULT_SIM_PRICE);

  const pythLastTimeRef = useRef<number>(0);
  const binanceLastTimeRef = useRef<number>(0);
  const lastKnownRealPriceRef = useRef<number>(DEFAULT_SIM_PRICE);

  const [activeSource, setActiveSource] = useState<PriceSource>('simulated');

  // Pyth WS
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connectPyth() {
      try {
        ws = new WebSocket(PYTH_WS_ENDPOINT);

        ws.onopen = () => {
          console.info(`[PRICE] Pyth WS connected: ${PYTH_WS_ENDPOINT}`);
          const subscribeMsg = JSON.stringify({
            type: 'subscribe',
            subscriptions: [
              {
                feedIds: [SOL_USD_FEED_ID],
                properties: ['price'],
                chains: ['solana'],
                deliveryFormat: 'json',
                channel: 'real_time',
              },
            ],
          });
          ws.send(subscribeMsg);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const feeds = data.parsed ?? data.priceInfos ?? [];

            for (const feed of feeds) {
              const parsedFeedId = Number(feed.feedId ?? feed.id);
              if (parsedFeedId !== SOL_USD_FEED_ID) continue;

              const rawPrice = feed.price ?? feed.bestAskPrice;
              if (rawPrice !== undefined && rawPrice !== null) {
                const price = Number(rawPrice) / 1e9;
                setPythPrice(price);
                pythLastTimeRef.current = Date.now();
                lastKnownRealPriceRef.current = price;
              }
            }
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          console.warn('[PRICE] Pyth WS disconnected');
          reconnectTimer = setTimeout(connectPyth, 3000);
        };
      } catch (e) {
        reconnectTimer = setTimeout(connectPyth, 5000);
      }
    }

    connectPyth();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  // Binance WS
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connectBinance() {
      try {
        ws = new WebSocket(BINANCE_WS_ENDPOINT);

        ws.onopen = () => {
          console.info('[PRICE] Binance WS connected');
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.p) {
              const price = parseFloat(msg.p);
              setBinancePrice(price);
              binanceLastTimeRef.current = Date.now();
              lastKnownRealPriceRef.current = price;
            }
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          console.warn('[PRICE] Binance WS disconnected');
          reconnectTimer = setTimeout(connectBinance, 3000);
        };
      } catch {
        reconnectTimer = setTimeout(connectBinance, 3000);
      }
    }

    connectBinance();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  // Simulator
  useEffect(() => {
    const interval = setInterval(() => {
      setSimulatedPrice((prev) => {
        const base = prev > 0 ? prev : lastKnownRealPriceRef.current;
        const next = base + (Math.random() - 0.5) * 0.04;
        return parseFloat(next.toFixed(2));
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Watchdog
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const pythAlive = now - pythLastTimeRef.current < PYTH_TIMEOUT_MS && pythPrice !== null;
      const binanceAlive = now - binanceLastTimeRef.current < BINANCE_TIMEOUT_MS && binancePrice !== null;

      if (pythAlive) {
        setActiveSource('pyth_ws');
      } else if (binanceAlive) {
        setActiveSource('binance_ws');
      } else {
        setActiveSource('simulated');
      }
    }, 500);

    return () => clearInterval(interval);
  }, [pythPrice, binancePrice]);

  return useMemo<RuntimePriceData>(() => {
    let currentPrice = simulatedPrice;
    
    if (activeSource === 'pyth_ws' && pythPrice !== null) {
      currentPrice = pythPrice;
    } else if (activeSource === 'binance_ws' && binancePrice !== null) {
      currentPrice = binancePrice;
    }

    return {
      currentPrice,
      source: activeSource,
      isLive: activeSource !== 'simulated',
      degraded: activeSource !== 'pyth_ws',
    };
  }, [activeSource, pythPrice, binancePrice, simulatedPrice]);
}
