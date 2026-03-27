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
 * Detect monitors that have been orphaned due to a missed Plaid webhook.
 * A monitor is orphaned when:
 * - status = 'active'
 * - position_id IS NULL
 * - created_at < NOW() - INTERVAL 'thresholdMinutes' minutes
 * - brokerage connection is_active = false
 *
 * These monitors cannot fire orders because their position link was lost
 * (typically due to an ITEM_ERROR webhook deactivating the brokerage connection
 * before the TRANSACTIONS_SYNC webhook could link positions).
 */
export async function detectOrphanedMonitors(
  thresholdMinutes: number = 15
): Promise<number> {
  const serviceClient = getServiceClient();

  // Find orphaned monitors: null position_id on an inactive brokerage connection
  // that have been in this state for longer than the threshold
  const { data: orphanedMonitors, error } = await serviceClient
    .from("sltp_monitors")
    .select("id, user_id, ticker, brokerage_connection_id")
    .eq("status", "active")
    .is("position_id", null)
    .lt("created_at", new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString());

  if (error || !orphanedMonitors || orphanedMonitors.length === 0) {
    return 0;
  }

  // Filter to only those whose brokerage connection is inactive
  const connectionIds = [...new Set(orphanedMonitors.map((m) => m.brokerage_connection_id))];

  const { data: connections } = await serviceClient
    .from("brokerage_connections")
    .select("id, is_active")
    .in("id", connectionIds)
    .eq("is_active", false);

  if (!connections || connections.length === 0) {
    return 0;
  }

  const inactiveConnectionIds = new Set(connections.map((c) => c.id));
  const monitorsToOrphan = orphanedMonitors.filter((m) => inactiveConnectionIds.has(m.brokerage_connection_id));

  if (monitorsToOrphan.length === 0) {
    return 0;
  }

  // Mark them as orphaned
  const { error: updateError } = await serviceClient
    .from("sltp_monitors")
    .update({ status: "orphaned", updated_at: new Date().toISOString() })
    .in("id", monitorsToOrphan.map((m) => m.id));

  if (updateError) {
    console.error("[SLTP Monitor] Failed to mark monitors as orphaned:", updateError);
    return 0;
  }

  console.log(`[SLTP Monitor] Marked ${monitorsToOrphan.length} monitors as orphaned`);
  return monitorsToOrphan.length;
}

/**
 * Run one cycle of the SL/TP monitor loop.
 * Called by the cron endpoint every 30 minutes.
 */
export async function runMonitorCycle(): Promise<{
  processed: number;
  triggered: number;
  errors: number;
  orphaned: number;
}> {
  if (!isMarketOpen()) {
    console.log("[SLTP Monitor] Outside market hours, skipping cycle");
    return { processed: 0, triggered: 0, errors: 0, orphaned: 0 };
  }

  const serviceClient = getServiceClient();

  // Detect and mark orphaned monitors first
  const orphanedCount = await detectOrphanedMonitors(15);

  // Fetch all active and orphaned monitors with their positions
  // Using LEFT JOIN (no !inner) so monitors with null position_id are still returned
  const { data: monitors, error } = await serviceClient
    .from("sltp_monitors")
    .select(
      `
      *,
      positions(id, quantity, brokerage_connection_id),
      signals!inner(id)
    `
    )
    .in("status", ["active", "orphaned"]);

  if (error || !monitors) {
    console.error("[SLTP Monitor] Failed to fetch active monitors:", error);
    return { processed: 0, triggered: 0, errors: 1, orphaned: orphanedCount };
  }

  if (monitors.length === 0) {
    return { processed: 0, triggered: 0, errors: 0, orphaned: orphanedCount };
  }

  // Collect unique tickers and fetch prices
  const uniqueTickers = [...new Set(monitors.map((m: SLTPMonitorRow & { positions: { id: string; quantity: number; brokerage_connection_id: string } | null }) => m.ticker))];
  const prices = await batchGetLastTrade(uniqueTickers);

  let triggered = 0;
  let errors = 0;

  for (const monitor of monitors as (SLTPMonitorRow & { positions: { id: string; quantity: number; brokerage_connection_id: string } | null })[]) {
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

    // Skip order placement if position_id is null (orphaned or waiting for first sync)
    // We still update trailing state above, but cannot fire orders without a linked position
    if (triggerType !== null && monitor.position_id === null) {
      // Orphaned monitor with no linked position - skip order placement
      if (Object.keys(updates).length > 1) {
        await serviceClient
          .from("sltp_monitors")
          .update(updates)
          .eq("id", monitor.id);
      }
      continue;
    }

    if (triggerType !== null) {
      // Determine which order side to place
      const side: "BUY" | "SELL" = monitor.action === "BUY" ? "SELL" : "BUY";
      const position = monitor.positions;

      // Guard: should not happen due to LEFT JOIN + position_id check above, but safety first
      if (!position) {
        console.error(`[SLTP Monitor] Monitor ${monitor.id} has no linked position, skipping`);
        errors++;
        continue;
      }

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
        triggered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (orderId === null) {
        // Order failed to place — do not mark as triggered
        statusUpdate.status = triggerType + "_place_failed";
        statusUpdate.error_message = "Order failed to place — manual intervention required";
        if (triggerType === "sl" || triggerType === "trailing") {
          statusUpdate.sl_order_id = null;
        } else {
          statusUpdate.tp_order_id = null;
        }
      } else {
        statusUpdate.status = statusMap[triggerType];
        if (triggerType === "sl" || triggerType === "trailing") {
          statusUpdate.sl_order_id = orderId;
        } else {
          statusUpdate.tp_order_id = orderId;
        }
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

  return { processed: monitors.length, triggered, errors, orphaned: orphanedCount };
}
