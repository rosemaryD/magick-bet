import { useEffect, useState, useRef } from 'react';

const PYTH_LAZER_WS_ENDPOINTS = [
  'wss://pyth-lazer-0.dourolabs.app/v1/stream',
  'wss://pyth-lazer-1.dourolabs.app/v1/stream',
];

const SOL_USD_FEED_ID = 6;

export interface PythPrice {
  price: number;
  confidence: number;
  publishTime: number;
  status: 'trading' | 'halted' | 'unknown';
}

interface PythStreamMessage {
  type?: string;
  parsed?: Array<{
    feedId?: number | string;
    id?: number | string;
    price?: number | string;
    bestAskPrice?: number | string;
    confidence?: number | string;
    publishTime?: number;
  }>;
  priceInfos?: Array<{
    feedId?: number | string;
    id?: number | string;
    price?: number | string;
    bestAskPrice?: number | string;
    confidence?: number | string;
    publishTime?: number;
  }>;
}

export function usePythPrice(feedId: number = SOL_USD_FEED_ID) {
  const [price, setPrice] = useState<PythPrice | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const endpointIndexRef = useRef(0);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const endpoint = PYTH_LAZER_WS_ENDPOINTS[endpointIndexRef.current % PYTH_LAZER_WS_ENDPOINTS.length];

      try {
        ws = new WebSocket(endpoint);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          setError(null);
          console.info(`[PRICE] Pyth WS connected: ${endpoint}`);

          const subscribeMsg = JSON.stringify({
            type: 'subscribe',
            subscriptions: [
              {
                feedIds: [feedId],
                properties: ['price', 'bestAskPrice', 'bestBidPrice'],
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
            const data = JSON.parse(event.data as string) as PythStreamMessage;
            const feeds = data.parsed ?? data.priceInfos ?? [];

            for (const feed of feeds) {
              const parsedFeedId = Number(feed.feedId ?? feed.id);
              if (parsedFeedId !== feedId) continue;

              const rawPrice = feed.price ?? feed.bestAskPrice;
              if (rawPrice === undefined || rawPrice === null) continue;

              setPrice({
                price: Number(rawPrice) / 1e9,
                confidence: Number(feed.confidence ?? 0) / 1e9,
                publishTime: feed.publishTime ?? Math.floor(Date.now() / 1000),
                status: 'trading',
              });
            }
          } catch {
            // Non-blocking decode failure for single WS message.
          }
        };

        ws.onerror = () => {
          setConnected(false);
          setError('WebSocket error');
          console.warn('[PRICE] Pyth WS error');
        };

        ws.onclose = () => {
          setConnected(false);
          endpointIndexRef.current += 1;
          console.warn('[PRICE] Pyth WS disconnected; trying next endpoint');
          reconnectTimer = setTimeout(connect, 3000);
        };
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to connect');
        setConnected(false);
        reconnectTimer = setTimeout(connect, 5000);
      }
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [feedId]);

  return { price, connected, error };
}
