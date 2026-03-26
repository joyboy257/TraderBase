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

  function connect() {
    if (closed) return;

    ws = new WebSocket(`${POLYGON_WS_URL}?apiKey=${POLYGON_API_KEY}`);

    ws.onopen = () => {
      console.log("[Polygon WS] Connected");
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
        console.log("[Polygon WS] Reconnecting in 3s...");
        reconnectTimer = setTimeout(connect, 3000);
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
 * Get the previous close quote for a ticker via REST API.
 */
export async function getQuote(ticker: string): Promise<PolygonQuote> {
  if (!POLYGON_API_KEY) {
    throw new Error("POLYGON_API_KEY is not set");
  }

  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${POLYGON_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Polygon REST API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error(`No results for ticker ${ticker}`);
  }

  const result = data.results[0];
  // result.c = close price, result.o = open, result.h = high, result.l = low
  // change is calculated from previous close vs current close
  const close = result.c;
  const open = result.o;
  const change = parseFloat((close - open).toFixed(4));
  const changePercent = parseFloat(((change / open) * 100).toFixed(2));

  return { price: close, change, changePercent };
}
