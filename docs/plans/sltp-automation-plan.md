# Implementation Plan: Stop-Loss / Take-Profit Automation

## Context

**Note:** Plaid is not yet live. This plan focuses on the infrastructure and data layer needed to support SL/TP automation when Plaid is connected. No actual order placement until Plaid is integrated.

**From brainstorm:**
- `signals.stop_loss` and `take_profit` already exist in schema — no migration needed for signals
- `positions` has `(user_id, ticker)` unique key — merge conflict problem for manual vs copied positions
- `postInvestmentOrder` requires `security_id` (Plaid internal), not ticker — need ticker-to-security_id lookup layer
- Polygon WebSocket client exists with auto-reconnect — can serve as real-time price feed

---

## 1. New Table: `sltp_monitors`

**File:** `supabase/migrations/YYYYMMDD_add_sltp_monitors.sql`

```sql
CREATE TABLE IF NOT EXISTS public.sltp_monitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  position_id UUID REFERENCES public.positions(id) ON DELETE CASCADE,
  copied_trade_id UUID REFERENCES public.copied_trades(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE,
  brokerage_connection_id UUID REFERENCES public.brokerage_connections(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
  stop_loss DECIMAL(10,2),
  take_profit DECIMAL(10,2),
  trailing_stop_pct DECIMAL(5,2),
  trailing_activate_pct DECIMAL(5,2) DEFAULT 0,
  trailing_high DECIMAL(10,2),
  trailing_low DECIMAL(10,2),
  entry_price DECIMAL(10,2) NOT NULL,
  sl_order_id TEXT,
  tp_order_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'sl_triggered', 'tp_triggered', 'trailing_triggered', 'cancelled')),
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sltp_monitors_status ON public.sltp_monitors(status) WHERE status = 'active';
CREATE INDEX idx_sltp_monitors_position_id ON public.sltp_monitors(position_id);
CREATE INDEX idx_sltp_monitors_user_id ON public.sltp_monitors(user_id);
CREATE INDEX idx_sltp_monitors_ticker ON public.sltp_monitors(ticker);
```

---

## 2. Positions Merge Conflict Fix

**Problem:** `positions` has `UNIQUE(user_id, ticker)` but upserts use `onConflict: "user_id,brokerage_connection_id,ticker"` — mismatched.

**File:** `supabase/migrations/YYYYMMDD_fix_positions_brokerage_unique.sql`

```sql
-- Data cleanup: keep newest row per (user_id, ticker, brokerage_connection_id)
DELETE FROM public.positions a
  USING public.positions b
  WHERE a.user_id = b.user_id
    AND a.ticker = b.ticker
    AND a.brokerage_connection_id = b.brokerage_connection_id
    AND a.id < b.id;

-- Drop incorrect constraint
ALTER TABLE public.positions DROP CONSTRAINT IF EXISTS positions_user_id_ticker_key;

-- Add correct constraint
ALTER TABLE public.positions ADD CONSTRAINT positions_user_id_ticker_brokerage_connection_id_key
  UNIQUE (user_id, ticker, brokerage_connection_id);
```

---

## 3. Ticker-to-Security_ID Cache

**Problem:** `postInvestmentOrder` requires Plaid `security_id`, not ticker.

### New Table
**File:** `supabase/migrations/YYYYMMDD_add_security_id_cache.sql`

```sql
CREATE TABLE IF NOT EXISTS public.security_id_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brokerage_connection_id UUID REFERENCES public.brokerage_connections(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  security_id TEXT NOT NULL,
  security_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brokerage_connection_id, ticker)
);

CREATE INDEX idx_security_id_cache_ticker ON public.security_id_cache(ticker);
CREATE INDEX idx_security_id_cache_connection_id ON public.security_id_cache(brokerage_connection_id);
```

### New lib file: `src/lib/plaid/security-cache.ts`

```typescript
// getSecurityId: single ticker lookup, returns null on miss
export async function getSecurityId(connectionId: string, ticker: string): Promise<string | null>

// getSecurityIdsBatch: batch lookup for cron job
export async function getSecurityIdsBatch(connectionId: string, tickers: string[]): Promise<Map<string, string>>

// upsertSecurityIdsFromHoldings: called at holdings sync time (in exchange-token, connections, webhooks)
export async function upsertSecurityIdsFromHoldings(connectionId: string, securities: PlaidSecurity[]): Promise<void>

// refreshSecurityIds: re-fetch from Plaid on cache miss
export async function refreshSecurityIds(connectionId: string, accessToken: string): Promise<void>
```

### Update existing call sites to populate cache:
- `/src/app/api/plaid/exchange-token/route.ts` — after `getInvestmentHoldings` call
- `/src/app/api/plaid/connections/route.ts` — after `getInvestmentHoldings` call
- `/src/app/api/webhooks/plaid/route.ts` — after `handleSyncUpdatesAvailable` positions upsert

---

## 4. Cron Job Architecture for Price Monitoring

### Endpoint
**New file:** `/src/app/api/cron/sltp-monitor/route.ts`

Protected by `CRON_SECRET` header. Configured via `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/sltp-monitor",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

### Monitor loop: `src/lib/sltp/monitor.ts`

```typescript
// 1. Fetch all active monitors
const activeMonitors = await supabase
  .from("sltp_monitors")
  .select(`*, positions!inner(...) , signals!inner(...)`)
  .eq("status", "active");

// 2. Batch fetch current prices from Polygon REST (getLastTrade per ticker)
const prices = await batchGetLastTrade(uniqueTickers);

// 3. For each monitor, evaluate thresholds:
// BUY:  current <= stop_loss → trigger SL
//        current >= take_profit → trigger TP
//        trailing_stop logic
// SELL: current >= stop_loss → trigger SL
//        current <= take_profit → trigger TP
//        trailing_stop logic

// 4. On trigger: UPDATE slt p_monitors.status, get security_id from cache, call Plaid
```

### Market hours guard
Only run during US market hours 9:30 AM - 4:00 PM ET on weekdays.

```typescript
function isMarketOpen(): boolean {
  // Check if current time is between 9:30 AM and 4:00 PM ET on a weekday
}
```

Skip the monitor loop outside market hours. Run pre-market check at 9:00 AM ET.

---

## 5. Trailing Stop Computation

```typescript
// Long position:
trailing_high = MAX(trailing_high, current_price)  // init on first tick
profit_threshold = entry_price * (1 + trailing_activate_pct / 100)
if (current_price >= profit_threshold) {
  trigger_price = trailing_high * (1 - trailing_stop_pct / 100)
  if (current_price <= trigger_price) trigger;
}

// Short position:
trailing_low = MIN(trailing_low, current_price)
profit_threshold = entry_price * (1 - trailing_activate_pct / 100)
if (current_price <= profit_threshold) {
  trigger_price = trailing_low * (1 + trailing_stop_pct / 100)
  if (current_price >= trigger_price) trigger;
}
```

State (`trailing_high`, `trailing_low`) stored in `sltp_monitors`, updated on each cron tick.

---

## 6. Creating Monitors in Copy Trading Flow

**File:** `src/lib/copy-trading/executor.ts`

After `copied_trades` insert succeeds with `status = 'executed'`:

```typescript
if ((typedSignal.stop_loss != null || typedSignal.take_profit != null) && insertedTrade) {
  await serviceClient.from("sltp_monitors").insert({
    user_id: followerId,
    position_id: null,  // linked when positions webhook fires
    copied_trade_id: insertedTrade.id,
    signal_id: signalId,
    brokerage_connection_id: typedBrokerage.id,
    ticker: typedSignal.ticker,
    action: typedSignal.action,
    stop_loss: typedSignal.stop_loss,
    take_profit: typedSignal.take_profit,
    entry_price: entryPrice,
    status: 'active',
  });
}
```

**Position linking:** In `handleSyncUpdatesAvailable` (webhook handler), after positions upsert:
```typescript
await serviceClient.from("sltp_monitors")
  .update({ position_id: positionId })
  .eq("user_id", connection.user_id)
  .eq("ticker", ticker)
  .eq("brokerage_connection_id", connection.id)
  .is("position_id", null);
```

---

## 7. Files Requiring Changes

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_add_sltp_monitors.sql` | **NEW** — `sltp_monitors` table |
| `supabase/migrations/YYYYMMDD_fix_positions_brokerage_unique.sql` | **NEW** — fix positions unique constraint |
| `supabase/migrations/YYYYMMDD_add_security_id_cache.sql` | **NEW** — `security_id_cache` table |
| `src/lib/plaid/security-cache.ts` | **NEW** — `getSecurityId`, `getSecurityIdsBatch`, `upsertSecurityIdsFromHoldings`, `refreshSecurityIds` |
| `src/lib/sltp/monitor.ts` | **NEW** — `evaluateMonitor`, `placeSLTPOrder`, `runMonitorCycle` |
| `src/app/api/cron/sltp-monitor/route.ts` | **NEW** — cron endpoint |
| `src/lib/copy-trading/executor.ts` | **MODIFY** — insert `sltp_monitors` row after successful copy trade |
| `src/app/api/webhooks/plaid/route.ts` | **MODIFY** — upsert `security_id_cache`, link monitors to positions |
| `src/app/api/plaid/exchange-token/route.ts` | **MODIFY** — upsert `security_id_cache` |
| `src/app/api/plaid/connections/route.ts` | **MODIFY** — upsert `security_id_cache` |
| `vercel.json` | **MODIFY** — add cron schedule |

---

## Verification Checklist

**Unit:**
- [ ] Trailing stop correctly updates `trailing_high` for BUY signals
- [ ] Trailing stop correctly updates `trailing_low` for SELL signals
- [ ] Trailing stop triggers only after `trailing_activate_pct` profit is reached
- [ ] SL triggers when `current_price <= stop_loss` for BUY
- [ ] TP triggers when `current_price >= take_profit` for BUY
- [ ] `getSecurityId` returns cached value; returns null on miss

**Integration:**
- [ ] Fresh brokerage link: `security_id_cache` populated with all holdings
- [ ] `executeCopyTrade` with SL/TP: `sltp_monitors` row created with `status='active'`
- [ ] Positions webhook fires: monitor's `position_id` is populated
- [ ] Cron job with valid secret returns 200; without returns 401
- [ ] Cron job outside market hours: skips gracefully
- [ ] After SL triggers: `status='sl_triggered'`, `sl_order_id` populated
