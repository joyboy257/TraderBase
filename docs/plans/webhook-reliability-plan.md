# Implementation Plan: Webhook Reliability

## Overview

**Current handler** (`src/app/api/webhooks/plaid/route.ts`): Fire-and-forget — `handleSyncUpdatesAvailable` runs as detached promise, `200 OK` sent before handler completes. No retry logic, no DLQ.

**Fix:** Replace fire-and-forget with insert-first queue pattern. `webhook_events` table with state machine, 3-attempt exponential backoff, DLQ for exhausted events.

---

## Step 1: New Migration — `webhook_events` Table

**File:** `supabase/migrations/20260401_01_add_webhook_events.sql`

```sql
CREATE TABLE public.webhook_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source        TEXT NOT NULL,
  event_id      TEXT NOT NULL,
  webhook_type  TEXT NOT NULL,
  webhook_code  TEXT NOT NULL,
  item_id       TEXT,
  raw_payload   JSONB NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts      INT NOT NULL DEFAULT 0,
  max_attempts  INT NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  last_error    TEXT,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source, event_id)
);

CREATE INDEX idx_webhook_events_status_retry
  ON public.webhook_events(status, next_retry_at)
  WHERE status = 'pending';

CREATE INDEX idx_webhook_events_source_item
  ON public.webhook_events(source, item_id);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage webhook_events"
  ON public.webhook_events FOR ALL
  USING (auth.role() = 'service_role');
```

**Derived event_id:** For webhooks without `notification_id`, construct composite: `item_id + webhook_type + webhook_code + (body.created_at ?? body.timestamp ?? NOW())`.

---

## Step 2: Refactor `route.ts` — Insert-First, Return Fast

**File:** `/home/claude/TraderBase/src/app/api/webhooks/plaid/route.ts`

**Add `deriveEventId` helper:**
```typescript
function deriveEventId(body: Record<string, unknown>): string {
  const notificationId = body.notification_id as string | undefined;
  if (notificationId) return notificationId;
  const itemId = (body.item_id as string) ?? "";
  const webhookType = (body.webhook_type as string) ?? "";
  const webhookCode = (body.webhook_code as string) ?? "";
  const ts = ((body.created_at ?? body.timestamp) as string) ?? new Date().toISOString();
  return `${itemId}::${webhookType}::${webhookCode}::${ts}`;
}
```

**Replace fire-and-forget (lines 44-53) with insert-first:**
```typescript
const eventId = deriveEventId(body);
const { error: insertError } = await serviceClient
  .from("webhook_events")
  .insert({
    source: "plaid",
    event_id: eventId,
    webhook_type: webhookType,
    webhook_code: webhookCode,
    item_id: itemId,
    raw_payload: body,
    status: "pending",
    attempts: 0,
    max_attempts: 3,
    next_retry_at: new Date().toISOString(),
  });

if (insertError) {
  if (insertError.code === "23505") {
    return NextResponse.json({ received: true }); // duplicate, already have it
  }
  console.error("Failed to queue webhook event:", insertError);
  return NextResponse.json({ error: "Queue unavailable" }, { status: 503 });
}

return NextResponse.json({ received: true });
```

---

## Step 3: Retry Worker — pg_cron for MVP

**File:** `supabase/migrations/YYYYMMDD_schedule_webhook_retry.sql`

```sql
SELECT cron.schedule(
  'process-webhook-retries',
  '* * * * *',
  $$SELECT public.process_pending_webhook_events()$$
);
```

**Database function:**
```sql
CREATE OR REPLACE FUNCTION public.process_pending_webhook_events()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  event_record RECORD;
  backoff_intervals INT[] := ARRAY[1, 10, 60]; -- minutes
BEGIN
  FOR event_record IN
    SELECT id, source, webhook_code, raw_payload, attempts, max_attempts, created_at
    FROM public.webhook_events
    WHERE status = 'pending'
      AND next_retry_at <= NOW()
    ORDER BY next_retry_at ASC
    LIMIT 50
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.webhook_events
    SET status = 'processing'
    WHERE id = event_record.id;

    -- Re-dispatch (MVP: via pg_net or HTTP call to internal endpoint)
    -- On success: UPDATE status='completed', resolved_at=NOW()
    -- On failure:
    --   attempts = attempts + 1
    --   last_error = <error>
    --   If attempts >= max_attempts: status = 'failed'
    --   Else: status = 'pending', next_retry_at = NOW() + backoff_intervals[attempts + 1] * INTERVAL '1 minute'
  END LOOP;
END;
$$;
```

---

## Step 4: Extract Handler Functions

**New file:** `src/lib/webhook/handlers/plaid.ts`

Move `handleSyncUpdatesAvailable` and `handleItemError` from `route.ts` into this file. The worker imports and calls them directly (not via HTTP).

---

## Step 5: DLQ Replay Endpoint

**New file:** `/src/app/api/admin/webhooks/replay/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const { webhookEventId } = await request.json();
  const { data: event } = await serviceClient
    .from("webhook_events")
    .select("*")
    .eq("id", webhookEventId)
    .eq("status", "failed")
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found or not in DLQ" }, { status: 404 });
  }

  await serviceClient
    .from("webhook_events")
    .update({
      status: "pending",
      attempts: 0,
      next_retry_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", webhookEventId);

  return NextResponse.json({ replayed: true });
}
```

---

## Exponential Backoff Schedule

| Attempt | Delay from previous | Cumulative |
|---------|---------------------|------------|
| 1 | immediate | 0 min |
| 2 | +1 minute | created_at + 1 min |
| 3 | +10 minutes | created_at + 11 min |
| 4 (DLQ) | — | created_at + 71 min |

---

## Files Requiring Changes

| File | Change |
|------|--------|
| `supabase/migrations/20260401_01_add_webhook_events.sql` | **NEW** — table, indexes, RLS |
| `supabase/migrations/YYYYMMDD_schedule_webhook_retry.sql` | **NEW** — pg_cron schedule |
| `src/app/api/webhooks/plaid/route.ts` | **MODIFY** — insert-first, deriveEventId, keep HMAC gate |
| `src/lib/webhook/handlers/plaid.ts` | **NEW** — extracted handler functions |
| `src/app/api/admin/webhooks/replay/route.ts` | **NEW** — DLQ replay endpoint |

---

## Verification Checklist

1. **Duplicate event dedup:** Send same Plaid webhook twice → second insert returns `200`, one row exists
2. **Exponential backoff:** Insert pending row → run worker → attempts=1, next_retry_at=+1min → run again → attempts=2, next_retry_at=+11min → run again → attempts=3, next_retry_at=+71min → run again → status='failed'
3. **Handler failure DLQ:** Mock handler to throw → event transitions to `failed` after 3 attempts, `last_error` set
4. **Replay endpoint:** Take a `failed` row → POST to replay → row resets to `pending`, attempts=0
5. **Happy path:** Send real Plaid webhook → `status='completed'`, `resolved_at` set
