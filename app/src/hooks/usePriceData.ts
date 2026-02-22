import { useState, useEffect, useRef, useCallback } from 'react';

export interface PricePoint {
  time: number;
  value: number;
}

export interface PriceData {
  currentPrice: number;
  priceHistory: PricePoint[];
  priceChange24h: number;
  isConnected: boolean;
}

interface BinancePriceResponse {
  price?: string;
}

interface Binance24hResponse {
  priceChangePercent?: string;
}

const MAX_HISTORY = 100;
const WS_URL = 'wss://stream.binance.com:9443/ws/solusdt@aggTrade';
const REST_URL = 'https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT';
const CHANGE_URL = 'https://api.binance.com/api/v3/ticker/24hr?symbol=SOLUSDT';

export function usePriceData(): PriceData {
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [priceChange24h, setPriceChange24h] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const isConnectedRef = useRef(false);

  const addPricePoint = useCallback((price: number) => {
    const point: PricePoint = {
      time: Math.floor(Date.now() / 1000),
      value: price,
    };

    setPriceHistory((prev) => {
      const next = [...prev, point];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
    setCurrentPrice(price);
  }, []);

  const fetchFallback = useCallback(async () => {
    try {
      const res = await fetch(REST_URL);
      const data = (await res.json()) as BinancePriceResponse;
      if (data.price && mountedRef.current) {
        addPricePoint(parseFloat(data.price));
      }
    } catch {
      // Best-effort fallback source, ignore transient errors.
    }
  }, [addPricePoint]);

  const fetch24hChange = useCallback(async () => {
    try {
      const res = await fetch(CHANGE_URL);
      const data = (await res.json()) as Binance24hResponse;
      if (data.priceChangePercent && mountedRef.current) {
        setPriceChange24h(parseFloat(data.priceChangePercent));
      }
    } catch {
      // Non-critical metadata.
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        console.info('[PRICE] Binance WS connected');
        setIsConnected(true);
        isConnectedRef.current = true;
      };

      ws.onmessage = (event: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data as string) as { p?: string };
          if (msg.p) {
            addPricePoint(parseFloat(msg.p));
          }
        } catch {
          // Ignore malformed WS payload.
        }
      };

      ws.onerror = () => {
        console.warn('[PRICE] Binance WS error; using REST fallback');
        fetchFallback();
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        console.warn('[PRICE] Binance WS disconnected; scheduling reconnect');
        setIsConnected(false);
        isConnectedRef.current = false;
        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, 3000);
      };
    } catch {
      setIsConnected(false);
      isConnectedRef.current = false;
      fetchFallback();
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, 3000);
    }
  }, [addPricePoint, fetchFallback]);

  useEffect(() => {
    mountedRef.current = true;

    fetchFallback();
    fetch24hChange();
    connect();

    const fallbackPoll = setInterval(() => {
      if (!isConnectedRef.current) {
        void fetchFallback();
      }
    }, 10_000);

    const changePoll = setInterval(() => {
      void fetch24hChange();
    }, 60_000);

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      clearInterval(fallbackPoll);
      clearInterval(changePoll);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect, fetch24hChange, fetchFallback]);

  return { currentPrice, priceHistory, priceChange24h, isConnected };
}
