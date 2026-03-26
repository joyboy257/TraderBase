# Implementation Plan: Idempotency Fix for Copy Trading

## Problem

**Root cause:** `executeCopyTrade` (`src/lib/copy-trading/executor.ts` lines 89-98) uses SELECT-then-INSERT. Two concurrent calls both pass SELECT, both hit Plaid, both try to INSERT — one gets a unique violation, or worse, both Plaid orders fire.

**Additional bugs:**
1. Idempotency key is 2-part (`signal_id:user_id`) per existing migration, but should be 3-part (`signal_id:follower_id:brokerage_connection_id`).
2. `brokerage_connection_id` is fetched after the SELECT — must be captured before Plaid is called for the key.
3. `copied_trades` has no RLS policies.

---

## Correct Pattern

`INSERT ... ON CONFLICT (idempotency_key) DO NOTHING RETURNING id, status`

- Winner: `RETURNING` gets a row → call Plaid → UPDATE with result
- Loser: `RETURNING` gets nothing → fetch existing row → return as success (don't call Plaid)

---

## Step 1: New Migration — Fix Idempotency Key to 3-Part

**File:** `supabase/migrations/20260330_fix_idempotency_key_3part.sql`

```sql
-- Backfill ALL existing rows with correct 3-part key
UPDATE public.copied_trades
SET idempotency_key = signal_id || ':' || user_id || ':' || brokerage_connection_id
WHERE idempotency_key IS NULL
   OR idempotency_key NOT LIKE '%:%:%';

-- Drop old 2-part unique index
DROP INDEX IF EXISTS idx_copied_trades_idempotency;

-- New unique index on 3-part key
CREATE UNIQUE INDEX idx_copied_trades_idempotency_3part
ON public.copied_trades(idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 3-part composite unique constraint as belt-and-suspenders
ALTER TABLE public.copied_trades
ADD CONSTRAINT copied_trades_3part_unique
UNIQUE (signal_id, user_id, brokerage_connection_id);

-- Enable RLS on copied_trades
ALTER TABLE public.copied_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own copied_trades"
ON public.copied_trades FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage copied_trades"
ON public.copied_trades FOR ALL
USING (auth.role() = 'service_role');
```

---

## Step 2: Replace SELECT-then-INSERT with INSERT ON CONFLICT

**File:** `src/lib/copy-trading/executor.ts`

### 2.1 Add idempotency key derivation helper

```typescript
function deriveIdempotencyKey(
  signalId: string,
  followerId: string,
  brokerageConnectionId: string
): string {
  return `${signalId}:${followerId}:${brokerageConnectionId}`;
}
```

### 2.2 Reorder: resolve brokerage BEFORE idempotency check

Move `brokerage_connection_id` resolution earlier (after follow check, before any idempotency check). Compute key immediately after `typedBrokerage` is available.

### 2.3 Atomic insert with ON CONFLICT

```typescript
const idempotencyKey = deriveIdempotencyKey(signalId, followerId, typedBrokerage.id);

const { data: insertResult, error: insertError } = await serviceClient
  .from("copied_trades")
  .insert({
    idempotency_key: idempotencyKey,
    user_id: followerId,
    signal_id: signalId,
    brokerage_connection_id: typedBrokerage.id,
    ticker: typedSignal.ticker,
    action: typedSignal.action,
    quantity: roundedQuantity,
    price: entryPrice,
    executed_at: new Date().toISOString(),
    status: "pending",
  })
  .onConflict("idempotency_key")
  .doNothing()
  .select("id, status")
  .single();

// Winner: insertResult returned with a row
// Loser: insertResult is null → fetch existing row
if (!insertResult) {
  const { data: existingRow } = await serviceClient
    .from("copied_trades")
    .select("id, status")
    .eq("idempotency_key", idempotencyKey)
    .single();

  if (existingRow) {
    // Treat pending as "in flight" success
    return { success: true, copied_trade_id: existingRow.id };
  }
}

// Winner branch: call Plaid
// After Plaid returns:
const { data: updatedTrade } = await serviceClient
  .from("copied_trades")
  .update({
    status: orderSuccess ? "executed" : "failed",
    error_message: orderErrorMessage,
    executed_at: new Date().toISOString(),
  })
  .eq("id", insertResult.id)
  .select("id")
  .single();

return orderSuccess
  ? { success: true, copied_trade_id: updatedTrade.id }
  : { success: false, copied_trade_id: updatedTrade.id, error: orderErrorMessage };
```

---

## Step 3: Retry Mechanism for Failed Rows

```typescript
export async function retryCopyTrade(
  copiedTradeId: string,
  options?: { forcePending?: boolean }
): Promise<CopyExecutionResult> {
  const { data: failedTrade, error: fetchError } = await serviceClient
    .from("copied_trades")
    .select("*")
    .eq("id", copiedTradeId)
    .single();

  if (fetchError || !failedTrade) {
    return { success: false, error: "Failed trade not found" };
  }

  if (failedTrade.status === "pending" && !options?.forcePending) {
    return { success: false, error: "Trade is pending. Use forcePending to override." };
  }

  const { error: deleteError } = await serviceClient
    .from("copied_trades")
    .delete()
    .eq("id", copiedTradeId);

  if (deleteError) {
    return { success: false, error: "Failed to delete failed trade row" };
  }

  return executeCopyTrade(failedTrade.user_id, failedTrade.signal_id);
}
```

Add to `src/app/actions/copy-trading.ts`: `retryCopyTradeAction` server action wrapper.

---

## Race Resolution Sequence

```
Caller A (wins)                    Caller B (loses)
──────────────────────────────────────────────────────
1. Get brokerage_connection_id      1. Get brokerage_connection_id
2. deriveIdempotencyKey(...)        2. deriveIdempotencyKey(...)
3. INSERT ... DO NOTHING            3. INSERT ... DO NOTHING
   RETURNING id, status               → No row returned
4. Call Plaid                       4. SELECT existing row
5. UPDATE status='executed'             → returns existing id+status
6. Return {success, id}            5. Return {success, existing.id}
```

---

## Files Requiring Changes

| File | Change |
|------|--------|
| `supabase/migrations/20260330_fix_idempotency_key_3part.sql` | **NEW** — re-backfill 3-part key, new indexes, RLS |
| `src/lib/copy-trading/executor.ts` | **MODIFY** — INSERT ON CONFLICT pattern, deriveIdempotencyKey helper, retry function |
| `src/app/actions/copy-trading.ts` | **MODIFY** — add `retryCopyTradeAction` |

---

## Verification Checklist

- [ ] Two concurrent `executeCopyTrade` for same `(signal_id, follower_id, brokerage_connection_id)` → Plaid called exactly once, one row created, both return success
- [ ] Existing `failed` row → `retryCopyTrade` → old row deleted, new row inserted
- [ ] `pending` row → re-call → returns success without calling Plaid
- [ ] Two different `brokerage_connection_id` for same user → two separate rows with different idempotency keys
- [ ] Migration: `SELECT idempotency_key, COUNT(*) GROUP BY idempotency_key HAVING COUNT(*) > 1` → 0 rows
