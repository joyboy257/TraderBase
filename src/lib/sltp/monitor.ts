import { createServerClient } from "@supabase/ssr";
import { getLastTrade } from "@/lib/polygon/client";
import { getSecurityId } from "@/lib/plaid/security-cache";
import { postInvestmentOrder } from "@/lib/plaid/client";

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/** Check if US market is currently open (9:30 AM - 4:00 PM ET, weekdays) */
export function isMarketOpen(): boolean {
  const now = new Date();
  // Convert to US Eastern Time
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay(); // 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) return false;

  const hours = et.getHours();
  const minutes = et.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // Market hours: 9:30 AM = 570 min, 4:00 PM = 960 min
  return totalMinutes >= 570 && totalMinutes < 960;
}

interface SLTPMonitorRow {
  id: string;
  user_id: string;
  position_id: string | null;
  brokerage_connection_id: string;
  ticker: string;
  action: "BUY" | "SELL";
  stop_loss: number | null;
  take_profit: number | null;
  trailing_stop_pct: number | null;
  trailing_activate_pct: number;
  trailing_high: number | null;
  trailing_low: number | null;
  entry_price: number;
  sl_order_id: string | null;
  tp_order_id: string | null;
  status: string;
}

/**
 * Evaluate a single monitor against the current price.
 * Returns the trigger type ('sl' | 'tp' | 'trailing' | null) if triggered.
 */
export function evaluateTrailingStop(
  monitor: SLTPMonitorRow,
  currentPrice: number
): "sl" | "tp" | "trailing" | null {
  const { action, entry_price, stop_loss, take_profit, trailing_stop_pct, trailing_activate_pct } = monitor;

  if (action === "BUY") {
    // SL: price drops to or below stop_loss
    if (stop_loss !== null && currentPrice <= stop_loss) {
      return "sl";
    }
    // TP: price rises to or above take_profit
    if (take_profit !== null && currentPrice >= take_profit) {
      return "tp";
    }
    // Trailing stop for BUY: track trailing_high
    if (trailing_stop_pct !== null && trailing_stop_pct > 0) {
      const profitThreshold = entry_price * (1 + trailing_activate_pct / 100);
      if (currentPrice >= profitThreshold) {
        const trailingHigh = monitor.trailing_high !== null ? Math.max(monitor.trailing_high, currentPrice) : currentPrice;
        const triggerPrice = trailingHigh * (1 - trailing_stop_pct / 100);
        if (currentPrice <= triggerPrice) {
          return "trailing";
        }
      }
    }
  } else if (action === "SELL") {
    // SL: price rises to or above stop_loss
    if (stop_loss !== null && currentPrice >= stop_loss) {
      return "sl";
    }
    // TP: price drops to or below take_profit
    if (take_profit !== null && currentPrice <= take_profit) {
      return "tp";
    }
    // Trailing stop for SELL: track trailing_low
    if (trailing_stop_pct !== null && trailing_stop_pct > 0) {
      const profitThreshold = entry_price * (1 - trailing_activate_pct / 100);
      if (currentPrice <= profitThreshold) {
        const trailingLow = monitor.trailing_low !== null ? Math.min(monitor.trailing_low, currentPrice) : currentPrice;
        const triggerPrice = trailingLow * (1 + trailing_stop_pct / 100);
        if (currentPrice >= triggerPrice) {
          return "trailing";
        }
      }
    }
  }

  return null;
}

/**
 * Place a SL or TP order via Plaid.
 * Returns the order_id if successful.
 */
async function placeSLTPOrder(
  accessToken: string,
  accountId: string,
  securityId: string,
  quantity: number,
  side: "BUY" | "SELL"
): Promise<string | null> {
  try {
    const result = await postInvestmentOrder(accessToken, accountId, [
      {
        security_id: securityId,
        quantity,
        type: "market",
        side,
      },
    ]);
    return result.order_id ?? null;
  } catch (err) {
    console.error("[SLTP] Order placement failed:", err);
    return null;
  }
}

/**
 * Fetch current prices for a list of tickers from Polygon.
 * Returns a Map of ticker -> price. Falls back gracefully per-ticker.
 */
async function batchGetLastTrade(
  tickers: string[]
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();

  const results = await Promise.allSettled(
    tickers.map(async (ticker) => {
      const { price } = await getLastTrade(ticker);
      return { ticker, price };
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      prices.set(result.value.ticker, result.value.price);
    }
  }

  return prices;
}

/**
 * Run one cycle of the SL/TP monitor loop.
 * Called by the cron endpoint every 30 minutes.
 */
export async function runMonitorCycle(): Promise<{
  processed: number;
  triggered: number;
  errors: number;
}> {
  if (!isMarketOpen()) {
    console.log("[SLTP Monitor] Outside market hours, skipping cycle");
    return { processed: 0, triggered: 0, errors: 0 };
  }

  const serviceClient = getServiceClient();

  // Fetch all active monitors with their positions
  const { data: monitors, error } = await serviceClient
    .from("sltp_monitors")
    .select(
      `
      *,
      positions!inner(id, quantity, brokerage_connection_id),
      signals!inner(id)
    `
    )
    .eq("status", "active");

  if (error || !monitors) {
    console.error("[SLTP Monitor] Failed to fetch active monitors:", error);
    return { processed: 0, triggered: 0, errors: 1 };
  }

  if (monitors.length === 0) {
    return { processed: 0, triggered: 0, errors: 0 };
  }

  // Collect unique tickers and fetch prices
  const uniqueTickers = [...new Set(monitors.map((m: SLTPMonitorRow & { positions: { brokerage_connection_id: string } }) => m.ticker))];
  const prices = await batchGetLastTrade(uniqueTickers);

  let triggered = 0;
  let errors = 0;

  for (const monitor of monitors as (SLTPMonitorRow & { positions: { id: string; quantity: number; brokerage_connection_id: string } })[]) {
    const currentPrice = prices.get(monitor.ticker);
    if (currentPrice === undefined) {
      console.warn(`[SLTP Monitor] No price for ${monitor.ticker}, skipping monitor ${monitor.id}`);
      errors++;
      continue;
    }

    // Update trailing high/low state
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (monitor.action === "BUY") {
      const newHigh = monitor.trailing_high !== null
        ? Math.max(monitor.trailing_high, currentPrice)
        : currentPrice;
      if (newHigh !== monitor.trailing_high) {
        updates.trailing_high = newHigh;
      }
    } else {
      const newLow = monitor.trailing_low !== null
        ? Math.min(monitor.trailing_low, currentPrice)
        : currentPrice;
      if (newLow !== monitor.trailing_low) {
        updates.trailing_low = newLow;
      }
    }

    // Evaluate trigger
    const triggerType = evaluateTrailingStop(monitor, currentPrice);

    if (triggerType !== null) {
      // Determine which order side to place
      const side: "BUY" | "SELL" = monitor.action === "BUY" ? "SELL" : "BUY";
      const position = monitor.positions;

      // Get security_id from cache
      const securityId = await getSecurityId(position.brokerage_connection_id, monitor.ticker);
      if (!securityId) {
        console.error(`[SLTP Monitor] No security_id for ${monitor.ticker} on monitor ${monitor.id}`);
        errors++;
        continue;
      }

      // Get decrypted access token
      const { data: brokerage } = await serviceClient
        .from("brokerage_connections")
        .select("plaid_access_token_encrypted, account_id")
        .eq("id", position.brokerage_connection_id)
        .single();

      if (!brokerage?.plaid_access_token_encrypted) {
        console.error(`[SLTP Monitor] No brokerage token for monitor ${monitor.id}`);
        errors++;
        continue;
      }

      const { decrypt } = await import("@/lib/crypto");
      const accessToken = brokerage.plaid_access_token_encrypted.includes(":")
        ? decrypt(brokerage.plaid_access_token_encrypted)
        : brokerage.plaid_access_token_encrypted;

      const orderId = await placeSLTPOrder(
        accessToken,
        brokerage.account_id,
        securityId,
        position.quantity,
        side
      );

      // Update monitor status
      const statusMap: Record<string, string> = {
        sl: "sl_triggered",
        tp: "tp_triggered",
        trailing: "trailing_triggered",
      };

      const statusUpdate: Record<string, unknown> = {
        status: statusMap[triggerType],
        triggered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (triggerType === "sl" || triggerType === "trailing") {
        statusUpdate.sl_order_id = orderId;
      } else {
        statusUpdate.tp_order_id = orderId;
      }

      await serviceClient
        .from("sltp_monitors")
        .update(statusUpdate)
        .eq("id", monitor.id);

      triggered++;
    } else if (Object.keys(updates).length > 1) {
      // Only update if trailing state changed
      await serviceClient
        .from("sltp_monitors")
        .update(updates)
        .eq("id", monitor.id);
    }
  }

  return { processed: monitors.length, triggered, errors };
}
