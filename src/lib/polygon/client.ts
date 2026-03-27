import WebSocket from "ws";

const POLYGON_WS_URL = process.env.POLYGON_WS_URL || "wss://ws.polygon.io";
const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

export interface TickerPrice {
  price: number;
  change: number;
  changePercent: number;
}

export interface PolygonQuote {
  price: number;
  change: number;
  changePercent: number;
}

/**
 * Connect to Polygon.io WebSocket and subscribe to trade updates for given tickers.
 * Returns a cleanup function to disconnect.
 */
export function connectPolygonWS(
  tickers: string[],
  onMessage: (ticker: string, price: number, change: number, changePercent: number) => void
): () => void {
  if (!POLYGON_API_KEY) {
    console.error("[Polygon] POLYGON_API_KEY is not set");
    return () => {};
  }

  const symbols = tickers.map((t) => `T.${t}`).join(",");
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let reconnectAttempt = 0;
  const BASE_DELAY_MS = 1000;    // 1 second
  const MAX_DELAY_MS = 30000;    // 30 seconds cap
  const JITTER_MS = 500;         // ±500ms random jitter

  function connect() {
    if (closed) return;

    ws = new WebSocket(`${POLYGON_WS_URL}?apiKey=${POLYGON_API_KEY}`);

    ws.onopen = () => {
      console.log("[Polygon WS] Connected");
      reconnectAttempt = 0;
      ws!.send(JSON.stringify({ action: "subscribe", params: symbols }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        // Polygon sends arrays of messages; look for trade updates
        const messages = Array.isArray(data) ? data : [data];
        for (const msg of messages) {
          if (msg.ev === "T" && msg.sym) {
            // Strip leading "T." prefix if present
            const ticker = msg.sym.startsWith("T.") ? msg.sym.slice(2) : msg.sym;
            const price = msg.p ?? msg.price;
            const change = msg.c ?? msg.change ?? 0;
            const changePercent = msg.cp ?? msg.changePercent ?? 0;
            if (price !== undefined) {
              onMessage(ticker, price, change, changePercent);
            }
          }
        }
      } catch (err) {
        console.error("[Polygon WS] Failed to parse message:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("[Polygon WS] Error:", err);
    };

    ws.onclose = () => {
      console.log("[Polygon WS] Disconnected");
      if (!closed) {
        reconnectAttempt++;
        const delay = Math.min(
          BASE_DELAY_MS * Math.pow(2, reconnectAttempt - 1) + Math.random() * JITTER_MS,
          MAX_DELAY_MS
        );
        console.log(`[Polygon WS] Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempt})...`);
        reconnectTimer = setTimeout(connect, delay);
      }
    };
  }

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      ws.close();
    }
  };
}

/**
 * Get the last trade price for a ticker via Polygon REST API.
 * Uses the /v3/last-trade/{ticker} endpoint for real-time data.
 */
export async function getLastTrade(ticker: string): Promise<{ price: number; timestamp: string }> {
  if (!POLYGON_API_KEY) {
    throw new Error("POLYGON_API_KEY is not set");
  }
  const url = `https://api.polygon.io/v3/last-trade/${ticker}?apiKey=${POLYGON_API_KEY}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Polygon REST API error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    if (!data.results) {
      throw new Error(`No trade data for ticker ${ticker}`);
    }
    return { price: data.results.p, timestamp: data.results.t };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Get the previous day's close price for a ticker via Polygon REST API.
 * Uses the /v2/aggs/ticker/{ticker}/prev endpoint.
 */
export async function getPreviousClose(ticker: string): Promise<{ close: number }> {
  if (!POLYGON_API_KEY) {
    throw new Error("POLYGON_API_KEY is not set");
  }
  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${POLYGON_API_KEY}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Polygon REST API error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      throw new Error(`No previous close data for ticker ${ticker}`);
    }
    return { close: data.results[0].c };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Get the current quote for a ticker via Polygon REST API.
 * Fetches today's latest trade price and compares to previous close.
 */
export async function getQuote(ticker: string): Promise<PolygonQuote> {
  if (!POLYGON_API_KEY) {
    throw new Error("POLYGON_API_KEY is not set");
  }

  try {
    // Get real-time last trade price
    const { price } = await getLastTrade(ticker);

    // Get previous close for change calculation
    let prevClose = 0;
    try {
      const { close } = await getPreviousClose(ticker);
      prevClose = close;
    } catch {
      // If we can't get previous close, set change to 0
      console.warn(`[getQuote] Could not get previous close for ${ticker}, setting change to 0`);
    }

    const change = prevClose > 0 ? parseFloat((price - prevClose).toFixed(4)) : 0;
    const changePercent = prevClose > 0 ? parseFloat(((change / prevClose) * 100).toFixed(2)) : 0;

    return { price, change, changePercent };
  } catch (err) {
    // Fallback to the original /range/1/day/1/now approach
    console.warn(`[getQuote] getLastTrade failed, falling back to range/1/day/1/now: ${err}`);
    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/1/now?adjusted=true&apiKey=${POLYGON_API_KEY}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`Polygon REST API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      if (!data.results || data.results.length === 0) {
        throw new Error(`No results for ticker ${ticker}`);
      }

      const result = data.results[data.results.length - 1];
      const close = result.c;
      const prevCloseFallback = result.o;

      const change = parseFloat((close - prevCloseFallback).toFixed(4));
      const changePercent = prevCloseFallback > 0 ? parseFloat(((change / prevCloseFallback) * 100).toFixed(2)) : 0;

      return { price: close, change, changePercent };
    } finally {
      clearTimeout(timeout);
    }
  }
}
