# Brainstorm: Idempotency Key for `processAllFollowers`

## What Already Exists

- `copied_trades` has `idempotency_key TEXT UNIQUE` + a unique index `idx_copied_trades_idempotency`
- `executeCopyTrade` (lines 89-98) already has a naive idempotency check: queries for `(signal_id, user_id)` and returns early if `status != 'failed'`
- The backfill in `20260326_add_copied_trades_idempotency.sql` uses `signal_id || ':' || user_id` — missing `brokerage_connection_id`

**Problem:** The naive check is a SELECT-then-INSERT race. Two concurrent `processAllFollowers` calls (from a double-fired Plaid webhook) can both pass the SELECT, both hit Plaid, both try to INSERT — one wins, one gets a unique violation on `idempotency_key`. Or worse: neither sees each other and both Plaid orders fire.

---

## Idempotency Key Derivation

**Proposed formula:** `{signal_id}:{follower_id}:{brokerage_connection_id}`

- `brokerage_connection_id` is the correct scope because a follower could hypothetically have multiple connections; the same `(signal_id, user_id)` should produce different keys per connection
- The `brokerage_connection_id` is fetched inside `executeCopyTrade` at step 4 — it must be captured **before** the Plaid call and carried through to the insert
- Derivation must be deterministic and stable — same inputs always produce the same key — so it can be recomputed on retry

**Current backfill bug:** `signal_id || ':' || user_id` is missing `:brokerage_connection_id`. This means existing rows don't have true idempotency protection. The backfill should be re-run with the correct 3-part key once the fix is deployed, or those rows accepted as a known migration artifact.

---

## DB Upsert Pattern

Replace the current SELECT-then-INSERT in `executeCopyTrade` with:

```sql
INSERT INTO copied_trades (idempotency_key, user_id, signal_id, brokerage_connection_id, ticker, action, quantity, price, executed_at, status, error_message)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING id, status;
```

Then check `RETURNING`:
- If a row is returned → this caller won the insert, proceed to Plaid
- If nothing returned → another call already inserted, fetch the existing row and return its `id` as success

This eliminates the race window entirely. The conflict is resolved at the DB row level, not in application logic.

**Why `ON CONFLICT DO NOTHING` (not `DO UPDATE`):**
Copy trading is not naturally idempotent in the "same result" sense — if the first Plaid call succeeded, re-applying the same order would be a second trade. `DO NOTHING` is the correct semantic: acknowledge the duplicate, don't re-execute. Whether to return the existing `executed` trade as success or detect and warn is an application-level concern on top.

---

## Race Condition Edge Cases

**Case 1: Double Plaid webhook, same `processAllFollowers` call**
- Both threads derive the same idempotency key
- Both attempt `ON CONFLICT DO NOTHING`
- One wins the insert, one gets no row back → fetches existing row → returns success with existing `id`
- Plaid is only called once (by the winner)
- Correct behavior

**Case 2: Two different signals fan out to the same follower**
- Different `signal_id` → different idempotency key → no conflict → both insert fine
- Correct behavior

**Case 3: Follower changes brokerage connection between retries**
- Old `brokerage_connection_id` → old idempotency key → no conflict on new key → new insert fires
- Old failed row is orphaned (acceptable for MVP; cleanup not urgent)

**Case 4: A `pending` trade exists, webhook fires again**
- Current code: skips because `status != 'failed'`
- After fix: `ON CONFLICT DO NOTHING` fires, we return existing row
- Question: should a `pending` be treated as "already in flight" and not re-called? Probably yes — return success
- The Plaid order is async; `pending` means order submitted but not confirmed. Re-submitting a market order for the same security/qty is risky

**Case 5: A `failed` trade exists, caller wants to retry**
- Current check allows retry (only skips if `status != 'failed'`)
- After fix with `ON CONFLICT`: the failed row's key blocks a new insert
- Retry must delete the failed row first, then re-derive the key and retry
- Alternatively: use `UPDATE` for `failed` rows only (more complex)

---

## Open Questions

1. **Retry UX for failed trades:** How does a user or system retry a `failed` copied_trade? Is there a manual "retry" button? An automatic retry with backoff? The idempotency key blocks re-insert until the failed row is cleared.

2. **Partial fill / async order state:** Plaid orders are async. `pending` is set immediately after `postInvestmentOrder` returns successfully. If Plaid later returns a `failed` status via a subsequent webhook, the `pending` row is now stale. Should `copied_trades.status` be updated on `TRANSACTIONS_SYNC`? This is related to the webhook DLQ idea (idea #5 in the ideation doc).

3. **Orphaned failed rows blocking retries:** If a trade fails at the Plaid level (e.g., insufficient funds), the row is `failed` and the idempotency key blocks re-insert. Either a "delete and retry" mechanism is needed, or the idempotency key is derived differently for retries (e.g., append a nonce).

4. **Backfill correctness:** Existing rows with the 2-part key (`signal_id:user_id`) may not be unique per `brokerage_connection_id`. Should these be re-backfilled with 3-part keys, or accepted as a one-time migration artifact?

5. **`ON CONFLICT DO NOTHING` + Plaid call ordering:** Currently Plaid is called before the insert. With `ON CONFLICT DO NOTHING` the insert can win or lose the race. If the insert wins, Plaid has been called unnecessarily (wastes API quota, potential duplicate order). If the insert loses, Plaid was not called but we return success. The safer ordering: **derive key → try insert with `ON CONFLICT DO NOTHING` first → if we won the insert, call Plaid → update status to `executed` or `failed`**. This ensures Plaid is only called when we hold the row.
