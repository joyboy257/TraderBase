"use client";

import { useEffect, useState } from "react";
import { connectPolygonWS, getQuote, TickerPrice } from "@/lib/polygon/client";

export interface PolygonPrices {
  prices: Map<string, TickerPrice>;
  isConnected: boolean;
}

/**
 * Hook that maintains real-time prices for the given tickers via Polygon.io WebSocket.
 */
export function usePolygonPrices(tickers: string[]): PolygonPrices {
  const [prices, setPrices] = useState<Map<string, TickerPrice>>(() => new Map());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (tickers.length === 0) return;

    // Initialize prices from REST API first
    async function initPrices() {
      try {
        const priceMap = new Map<string, TickerPrice>();
        await Promise.all(
          tickers.map(async (ticker) => {
            try {
              const quote = await getQuote(ticker);
              priceMap.set(ticker, quote);
            } catch (err) {
              console.warn(`[usePolygonPrices] Failed to get initial quote for ${ticker}:`, err);
              // Use placeholder so the ticker still appears
              priceMap.set(ticker, { price: 0, change: 0, changePercent: 0 });
            }
          })
        );
        setPrices(priceMap);
      } catch (err) {
        console.error("[usePolygonPrices] Failed to initialize prices:", err);
      }
    }

    initPrices();

    // Set up WebSocket
    const cleanup = connectPolygonWS(tickers, (ticker, price, change, changePercent) => {
      setPrices((prev) => {
        const next = new Map(prev);
        next.set(ticker, { price, change, changePercent });
        return next;
      });
    });

    // Optimistically set connected; actual tracking is approximate since
    // the ws library doesn't expose an explicit connected state callback.
    setIsConnected(true);

    return () => {
      cleanup();
      setIsConnected(false);
    };
  }, [tickers.join(",")]);

  return { prices, isConnected };
}
