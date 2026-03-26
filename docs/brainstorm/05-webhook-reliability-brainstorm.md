# Brainstorm: Webhook Reliability — Retry Queue + Dead-Letter Queue

**Idea #5 from ideation doc**
**Date:** 2026-03-26

---

## What's Broken

The Plaid webhook handler at `src/app/api/webhooks/plaid/route.ts` has zero reliability infrastructure:

- `handleSyncUpdatesAvailable` and `handleItemError` are fire-and-forget — the handler returns `200 OK` immediately after spawning them with `.catch(console.error)`. If the DB is down, the token fails to decrypt, or `getInvestmentHoldings` throws, the error is logged and the event vanishes.
- No record exists of what webhooks fired, in what order, or whether they succeeded.
- Plaid does not retry webhooks automatically — if our server returns 200 but the handler throws silently, Plaid has no way to know.

---

## DLQ Table Schema

```sql
CREATE TABLE public.webhook_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source        TEXT NOT NULL,          -- e.g. 'plaid'
  event_id      TEXT NOT NULL,          -- Plaid's unique webhook ID (if available)
  webhook_type  TEXT NOT NULL,          -- 'INVESTMENTS', 'TRANSACTIONS', etc.
  webhook_code  TEXT NOT NULL,          -- 'SYNC_UPDATES_AVAILABLE', 'ITEM_ERROR', etc.
  item_id       TEXT,                    -- Plaid item_id (useful for dedup)
  raw_payload   JSONB NOT NULL,         -- original full webhook body
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts      INT NOT NULL DEFAULT 0,
  max_attempts  INT NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  last_error    TEXT,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  -- Idempotency: dedupe Plaid's own retry-before-give-up behavior
  UNIQUE(source, event_id)
);

CREATE INDEX idx_webhook_events_status_retry
  ON public.webhook_events(status, next_retry_at)
  WHERE status = 'pending';

CREATE INDEX idx_webhook_events_source_item
  ON public.webhook_events(source, item_id);
```

**Notes on `event_id`:**
Plaid includes a `notification_id` in some webhook types and an `item_id` in all. Use `item_id + webhook_type + webhook_code + some timestamp hash` as the deduplication key if Plaid doesn't provide a stable unique ID. The unique constraint prevents double-inserting from Plaid's own retry-before-giving-up behavior.

---

## Retry Strategy

**Exponential backoff schedule (3 attempts):**

| Attempt | Delay   | Next retry at          |
|---------|---------|-------------------------|
| 1       | 1 min   | created_at + 1 min      |
| 2       | 10 min  | created_at + 11 min     |
| 3       | 1 hour  | created_at + 1h 11 min  |

After attempt 3 fails → status = `'failed'` (DLQ).

**State machine:**

```
pending → processing → completed
                  → failed (DLQ, after 3 attempts)
                  → pending (retry, if attempts < 3)
```

The handler itself should NOT run the business logic synchronously. Instead:

1. **On webhook receipt:** Insert into `webhook_events` with `status = 'pending'`, return `200` immediately.
2. **Retry worker (cron/edge):** Polls for rows where `status = 'pending' AND next_retry_at <= NOW()`, sets `status = 'processing'`, runs the handler, then marks `completed` or increments `attempts` + sets `next_retry_at`.
3. **On terminal failure:** Set `status = 'failed'`, preserve `last_error`.

**Retry worker options:**
- **Supabase pg_cron**: Schedule a function that polls and processes in-database. No external infra. Limitation: cron jobs run at most once per minute, fine for backoff but not real-time.
- **Next.js Route Handler + setTimeout for dev**: For MVP, process retries on the next incoming webhook request (cooperative polling). Check and process one batch on each real webhook arrival.
- **Supabase Edge Functions**: Better for async processing without blocking HTTP responses.

---

## Plaid Verification in the Retry Path

The current flow verifies the `Plaid-Verification` JWT header at receipt time. This is correct — the header proves the request came from Plaid. **But verification tokens expire.** If we queue a webhook and try to verify hours later, `verifyWebhookToken` will fail because the JWT timestamp is stale.

**Solution:** Do the verification once, at receipt time, as a gate before inserting into `webhook_events`. If verification fails, return `401` immediately and do not queue. The Plaid webhook spec says to return `401` for invalid verification — this is correct and we already do it.

For the retry worker, re-verification is unnecessary since:
- The event is already in our DB with a verified payload.
- The `item_id` lookup ties it to a specific Plaid Item.
- If a token is rotated on Plaid's side, the next incoming webhook for that item will fail verification and alert us.

---

## Edge Cases

1. **Plaid sends the same event multiple times (up to ~5 retries on their side before they give up).** The `UNIQUE(source, event_id)` constraint prevents double-insertion. The idempotent handler logic will handle the duplicate gracefully.

2. **Stale verification token on retry.** Verification is a one-time gate at receipt, not on retry. This avoids stale token failures on later attempts.

3. **`notification_id` not always present.** For webhooks that lack a stable unique ID, derive a composite key from `item_id + webhook_type + webhook_code + created_at::date` and accept a small window of dedup collision risk. Log and monitor for duplicate processing.

4. **Handler partially succeeds then fails mid-way.** e.g., `positions.upsert` succeeds but the return fires. The retry worker will re-run the entire `handleSyncUpdatesAvailable` logic. This is safe because Plaid's `TRANSACTIONS_SYNC` is idempotent (calling it again returns the same delta). For non-idempotent operations, wrap the whole thing in a transaction or use `copied_trades.idempotency_key`.

5. **DLQ grows unbounded.** Needs a UI for ops to inspect and replay. Minimum: filterable table with `status = 'failed'`, a "Replay" button that resets `status = 'pending'` and `attempts = 0`.

6. **Server restart during processing.** `status = 'processing'` rows with `next_retry_at` in the past should be re-claimed by the worker. Add a timeout: if a row has been `processing` for > 5 minutes, treat it as failed and allow retry.

7. **High volume of webhooks.** The `pending` queue could grow large if the worker can't keep up. Consider batching (process N rows per cron run) and scaling workers horizontally (separate cron, single DB lock via `FOR UPDATE SKIP LOCKED`).

---

## Open Questions

1. **What is Plaid's exact retry behavior?** Do they retry on 5xx? On our 200 but handler throws? The docs suggest they retry with exponential backoff for ~24 hours, then give up. We need to confirm this to size our DLQ.

2. **Should we store `webhook_events` for successful events too?** Yes — having the full audit trail is critical for financial operations. Store all events; only DLQ the ones that fail after all retries.

3. **Replay mechanism for DLQ events?** A simple approach: expose a `POST /api/admin/webhooks/replay` that takes a `webhook_event_id`, verifies the `item_id` is still active, and resets the row to `pending`. Or a Supabase function invoked by the ops UI.

4. **Do we need alerting on DLQ growth?** Yes — a `pg_cron` job that checks `SELECT COUNT(*) FROM webhook_events WHERE status = 'failed'` and sends a Slack alert if > N. Or use a simple count check on the admin dashboard.

5. **Extension to non-Plaid webhooks?** The `source` column and generic handler interface make this extensible. Future: Polygon.io, other brokers. Keep it generic now.

---

## Relationship to Idempotency Key (Idea #6)

The `copied_trades.idempotency_key` and the `webhook_events` table address different layers:

- `webhook_events` — ensures the webhook itself is not lost (at-least-once delivery guarantee).
- `copied_trades.idempotency_key` — ensures the downstream copy trade execution is not duplicated (exactly-once execution guarantee).

Both are needed. Idea #6 is a prerequisite for the DLQ replay to be safe: when replaying a DLQ event, the handler must use `ON CONFLICT DO NOTHING` on `copied_trades(idempotency_key)` so replaying an already-executed signal doesn't double-execute.

---

## Files Involved

- `src/app/api/webhooks/plaid/route.ts` — webhook receipt, needs refactor to queue-first
- `src/lib/plaid/client.ts` — `verifyWebhookToken`, `verifyPlaidWebhook` (no changes needed)
- `supabase/migrations/` — new migration for `webhook_events` table
- New: `src/lib/webhook/worker.ts` — retry worker (cron or cooperative)
- New: `src/lib/webhook/handlers/plaid.ts` — extracted handler logic (already exists partially as `handleSyncUpdatesAvailable`)
- New: `src/app/api/admin/webhooks/replay/route.ts` — DLQ replay endpoint
