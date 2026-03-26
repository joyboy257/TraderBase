# Brainstorm: Stop-Loss / Take-Profit Automation + Trailing Stops

## System Architecture

### The Core Loop
When a copied trade is executed, we need to:
1. Link the `copied_trades` row to its source `signals` row (already done via `signal_id`)
2. When a position is opened for a copied trade, create an SL/TP monitoring record
3. Continuously compare `positions.current_price` vs SL/TP thresholds from the linked signal
4. When a threshold is hit, place a SELL market order via Plaid

### New Table: `sltp_monitors`
```
sltp_monitors (
  id UUID PRIMARY KEY,
  user_id UUID,
  position_id UUID,          -- links to positions.id
  signal_id UUID,            -- links to signals.id
  stop_loss DECIMAL(10,2),
  take_profit DECIMAL(10,2),
  trailing_stop_pct DECIMAL(5,2),  -- NULL = no trailing, e.g. 10.0 = 10%
  trailing_high DECIMAL(10,2),     -- highest price since entry (for longs)
  trailing_low DECIMAL(10,2),      -- lowest price since entry (for shorts)
  sl_order_id TEXT,         -- Plaid order_id once placed
  tp_order_id TEXT,
  status TEXT DEFAULT 'active',   -- active | sl_triggered | tp_triggered | cancelled
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```
- One row per open position being monitored
- Created when `copied_trades.status = 'executed'` AND position is confirmed open
- Cascade delete when position is closed

### Order Types Needed

**For SL/TP (market orders):**
- `InvestmentOrder { security_id, quantity, type: "market", side: "SELL" }`
- Critical gap: `postInvestmentOrder` requires `security_id` (Plaid's internal ID), NOT ticker symbol
- Need a `ticker → security_id` lookup table (hydrate from Plaid holdings/securities data on link)

**For Trailing Stops:**
- No native trailing stop order in Plaid's `/investments/orders/post`
- Must implement as a computed threshold in application code:
  - Long: `trailing_high` = max price seen; trigger SELL when `current_price <= trailing_high * (1 - trailing_stop_pct/100)`
  - Short: `trailing_low` = min price seen; trigger SELL when `current_price >= trailing_low * (1 + trailing_stop_pct/100)`
- Placed as a regular SELL market order when computed threshold is crossed

---

## Background Job Architecture

### Option A: Cron (Vercel Cron / Supabase pg_cron)
- **Frequency:** Every 30–60 seconds during market hours
- **Query:** `SELECT * FROM positions p JOIN sltp_monitors m ON m.position_id = p.id WHERE m.status = 'active'`
- **Pros:** Simple, predictable, works with existing infrastructure
- **Cons:** Latency between price change and order execution; market-hours-only logic adds complexity
- **Implementation:** A Next.js Route Handler (`/api/cron/sltp-monitor`) protected by a cron secret, or a `pg_cron` job calling a Postgres function
- **Price fetch:** Batch `getLastTrade` calls to Polygon REST for all unique tickers in one cron run (limit ~50 tickers/request to avoid rate limits)

### Option B: Polygon WebSocket (Real-Time)
- **Approach:** Maintain a persistent WS connection (server process or edge function with `run_in_background`)
- Subscribe to trade updates for all tickers that have active `sltp_monitors`
- On each price tick: evaluate all active monitors for that ticker
- **Pros:** Sub-second reaction time; only subscribed to needed tickers
- **Cons:** Requires a always-on process (not serverless-friendly); reconnect logic needed (already in `connectPolygonWS`)
- **Hybrid approach:** Use WebSocket as the primary real-time path, with a cron fallback every 5 min to catch any missed updates

### Recommendation: Start with Option A (Cron) as MVP
- Simpler to implement and debug
- 30-second polling is fast enough for SL/TP use cases (not HFT)
- WebSocket can be added as a v2 optimization
- Hybrid can come later: WS for real-time, cron as consistency anchor

---

## Price Monitoring Strategy

1. **On each job run (or WS tick):**
   ```
   FOR EACH active sltp_monitor:
     current_price = fetch from Polygon (getLastTrade)
     position = fetch from positions table

     IF signal.action = 'BUY':
       # Long position
       IF stop_loss AND current_price <= stop_loss: trigger SL
       IF take_profit AND current_price >= take_profit: trigger TP
       IF trailing_stop_pct:
         trailing_high = MAX(trailing_high, current_price)
         trigger_price = trailing_high * (1 - trailing_stop_pct/100)
         IF current_price <= trigger_price: trigger trailing SL

     IF signal.action = 'SELL':
       # Short position (if supported)
       IF stop_loss AND current_price >= stop_loss: trigger SL
       IF take_profit AND current_price <= take_profit: trigger TP
       IF trailing_stop_pct:
         trailing_low = MIN(trailing_low, current_price)
         trigger_price = trailing_low * (1 + trailing_stop_pct/100)
         IF current_price >= trigger_price: trigger trailing SL
   ```

2. **Trigger action:**
   - Set `sltp_monitor.status = 'sl_triggered' | 'tp_triggered'`
   - Decrypt Plaid access token from `brokerage_connections`
   - Look up `security_id` from cached ticker→security_id map
   - Call `postInvestmentOrder(accessToken, accountId, [{ security_id, quantity, type: "market", side: "SELL" }])`
   - Record Plaid `order_id` in `sltp_monitors.sl_order_id` or `tp_order_id`
   - Mark `copied_trades.status` or add a `closed_at` timestamp

3. **Idempotency:** Use `copied_trades.idempotency_key` (signal_id + follower_id + brokerage_connection_id) to ensure SL/TP fires at most once per copy relationship

---

## Edge Cases

### Gap Down Past SL (overnight or pre-market)
- Price opens below stop-loss — no trade occurs at the SL level
- **Mitigation:** Use stop-limit orders instead of market orders, with a buffer (e.g., SL price = signal stop_loss, limit price = signal stop_loss * 0.98). Plaid's API only supports market orders via `/investments/orders/post`, so this is NOT currently possible. Accept as a known gap risk until Plaid adds stop-limit support.
- **Alternative:** After market open, immediately check all positions where prior close < SL and fire the order at market open price

### Partial Fills
- Plaid order may fill for less than full quantity (e.g., low liquidity)
- **Mitigation:** After order execution, reconcile by re-fetching position via `getInvestmentHoldings`. If position quantity > 0, keep SL/TP monitor active with remaining quantity. If quantity = 0, mark monitor as fully closed.
- The `positions` table is updated by the Plaid TRANSACTIONS_SYNC webhook, so position quantities should be fresh within minutes

### Corporate Actions (splits, dividends, mergers)
- A stock split changes the relationship between entry price, SL/TP, and current price
- **Mitigation:** No automatic handling in MVP. Corporate action webhooks from Plaid (`ITEM:ERROR` or `HOLDINGS:DEFAULT_UPDATE`) should trigger a re-evaluation of all monitors for that ticker. Prestore a `split_adjustment_factor` on the monitor, or simpler: close and re-create monitors on any corporate action webhook.
- Dividends do not affect SL/TP logic (unrealized_pnl includes dividend reinvestment in most brokers)

### Signal Expiration
- Signals have an `expires_at` field. If a copied trade is placed after a signal has expired, SL/TP should still be set — the signal's SL/TP fields are the authoritative values at the time of copy.
- If `stop_loss` or `take_profit` is NULL on the signal, do NOT set a monitor for that direction

### Multiple Positions in Same Ticker
- User may have an existing manual position in a ticker they're also copying
- Copy trade creates a second position row (same user + same ticker, but different `brokerage_connection_id`? Or does the existing position get appended to?)
- **Clarification needed:** If `positions` is keyed on `(user_id, ticker)` per the schema, manual and copied positions in the same ticker merge into one row — making it impossible to track which SL/TP applies to which entry
- **Fix:** Either (a) change positions PK to include `brokerage_connection_id`, or (b) add a `signal_id` column to positions to trace the origin, or (c) treat all SL/TP on a ticker as the tightest SL and furthest TP across all copy relationships

### Stop-Loss Below Average Cost on Buy Signal (loss already realized)
- If signal's stop_loss is above current average_cost for a long position... actually this is fine, it just means the SL protects profit not locks in a loss

### Trailing Stop Activation
- Trailing stops should only activate after price moves in the profitable direction by some threshold (e.g., activate trailing stop only after TP is halfway met, or after a 1% move in favor)
- Simple approach: trailing stop activates immediately on position open; `trailing_high` starts at entry price, so first price drop triggers it immediately unless a minimum profit buffer is set
- **Recommendation:** Add `trailing_activate_pct` field; trailing stop only arms when `current_price >= entry_price * (1 + trailing_activate_pct/100)`

---

## Open Questions

1. **Plaid security_id lookup:** How do we map a ticker to Plaid's `security_id`? Options: cache it from `getInvestmentHoldings` (hydrate on brokerage link), or look it up via Plaid's `/investments/securities/get` by ticker. Which brokers return ticker-symbols reliably in the `securities` table?

2. **Which account to trade from:** Users may have multiple brokerage accounts linked. The `copied_trades` and `sltp_monitors` table already track `brokerage_connection_id`. Use that account's `account_id` for the order.

3. **Order confirmation lag:** Plaid's `/investments/orders/post` is asynchronous. The order may not fill immediately. Do we mark the position as "pending close" and reconcile on next webhook/holdings refresh?

4. **Copy ratio impact:** If a user copies at 50% ratio, their position size is smaller than the leader's. SL/TP should use the signal's absolute prices, not scaled. The position's quantity is already correct (scaled). The SL/TP prices from the signal are absolute.

5. **Turn off SL/TP mid-trade:** If user unfollows the leader mid-trade, should we cancel the SL/TP monitor? Likely yes — add `is_active` column or delete the monitor row when the follow is deactivated.

6. **Rate limits:** Polygon WS handles many tickers; Polygon REST has rate limits (~5 requests/minute on free tier). Batch all tickers into a single cron run; don't make one Polygon call per position per cron run.

7. **Market hours:** Should SL/TP monitors only fire during market hours? After-hours moves can gap past SL. Recommend monitoring only during 9:30–4:00 ET US markets, with a pre-market check at 9:00 ET.

8. **Leader closes their position:** If the signal trader closes their position (SELL signal), should followers' SL/TP monitors be cancelled or left to run on the follower's own timeline? Probably cancel — add a `signal.action = 'SELL'` to trigger monitor cancellation for BUY signals.
