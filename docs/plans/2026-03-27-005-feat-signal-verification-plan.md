---
title: "feat: Signal Verification Pipeline"
type: feat
status: active
date: 2026-03-27
origin: docs/ideation/2026-03-27-open-ideation.md
deepened: 2026-03-27
---

# feat: Signal Verification Pipeline

## Overview

Implement MVP signal verification: when a trader posts a signal, cross-reference the ticker/action against their recent Plaid positions. If a matching BUY/SELL position exists in the last 24 hours, mark the signal as `is_verified = true`. The `is_verified` field currently exists in the schema but nothing ever sets it to true.

## Problem Frame

The verified badge appears on trader cards and signal rows but is pure theater — no code verifies anything. The MVP approach (position audit) is the most credible verification method: a signal is verified if the trader actually held the position.

## Requirements Trace

- R1. Signals created by traders with active Plaid connections are automatically evaluated for verification
- R2. Signals where a matching Plaid position exists (same ticker, same action) within 24 hours are marked `is_verified = true`
- R3. `verified_at` timestamp and `verified_method` are recorded on verified signals
- R4. Verification is idempotent — re-running doesn't cause side effects

## Scope Boundaries

- Does NOT define the product meaning of "verified" — this is an MVP implementation of Option B (position audit)
- Does NOT verify traders without a Plaid connection (they just stay unverified)
- Does NOT retroactively verify old signals (only new signals going forward)
- Does NOT build a manual admin verification flow

## Key Technical Decisions

- **Verification method:** `position_audit` — signals verified by cross-referencing Plaid position history
- **Time window:** 24 hours — a signal for a ticker/action the trader held within the last day is verified
- **Trigger:** Verification runs after signal INSERT — not in the same transaction (would add latency to signal creation). A Supabase `AFTER INSERT` trigger on `signals` table fires a database function that performs the verification check asynchronously.
- **Fallback:** If the database trigger approach is too complex, a Supabase Realtime subscription on `signals` INSERT in a background job is an alternative. The database trigger is preferred for atomicity.

## Open Questions

### Resolved During Planning

- **Q: What if the trader has multiple positions in the same ticker?** A: Any position matching the signal's action (BUY/SELL) within the window is sufficient.
- **Q: What if Plaid hasn't synced positions yet?** A: Signal stays `is_verified = false`. When Plaid syncs, a separate reconciliation can retroactively verify — deferred to follow-up.
- **Q: Should we verify SELL signals?** A: Yes — a SELL signal is verified if the trader had a long position in that ticker, or a SHORT position if that's supported.

### Deferred to Implementation

- Exact Postgres `AFTER INSERT` trigger function syntax
- Whether to verify `signal.created_at` against `positions.updated_at` or a separate `positions.hold_since` column

## Implementation Units

- [ ] **Unit 1: Add `verified_at` and `verified_method` to `signals` table**

**Goal:** Schema extension to record verification metadata

**Requirements:** R3

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/20260327_add_signal_verification_columns.sql`

**Approach:**
```sql
ALTER TABLE signals
  ADD COLUMN verified_at TIMESTAMPTZ,
  ADD COLUMN verified_method TEXT;  -- e.g., 'position_audit', 'manual', 'brokerage_link'
```

**Test scenarios:**
- New signals have `verified_at = NULL` initially
- After verification runs, `verified_at` is a timestamp and `verified_method = 'position_audit'`

**Verification:**
- Migration applies cleanly
- Existing signals unaffected (verified_at NULL)

- [ ] **Unit 2: Create `verify_signal_position_audit` Postgres function**

**Goal:** Pure SQL function that checks if a signal's ticker/action matches the leader's recent Plaid positions

**Requirements:** R1, R2, R4

**Dependencies:** Unit 1

**Files:**
- Create: `supabase/migrations/20260327_add_verify_signal_function.sql`

**Approach:**
```sql
-- Directional guidance — actual SQL deferred to implementation
CREATE OR REPLACE FUNCTION verify_signal_position_audit(signal_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  sig signals%ROWTYPE;
  pos_record positions%ROWTYPE;
BEGIN
  -- Fetch the signal
  SELECT * INTO sig FROM signals WHERE id = signal_id;

  -- If trader has no active brokerage connection, cannot verify
  -- If signal is not active, skip

  -- Check: does leader have a position matching sig.ticker AND sig.action
  -- within 24 hours of sig.created_at?
  SELECT * INTO pos_record
  FROM positions
  WHERE user_id = sig.user_id
    AND ticker = sig.ticker
    AND (sig.action = 'BUY' AND quantity > 0)
    AND updated_at >= sig.created_at - INTERVAL '24 hours'
  LIMIT 1;

  IF pos_record.id IS NOT NULL THEN
    UPDATE signals
    SET is_verified = true,
        verified_at = now(),
        verified_method = 'position_audit'
    WHERE id = signal_id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
```

**Patterns to follow:**
- Existing Postgres function patterns in Supabase migrations
- `auth.uid()` usage for user context

**Test scenarios:**
- Signal with matching BUY position within 24 hours → function returns TRUE, signal updated
- Signal without matching position → function returns FALSE, signal unchanged
- Signal from trader with no Plaid connection → function returns FALSE

**Verification:**
- Function runs without error on a test database
- Correct signals are verified, incorrect signals are not

- [ ] **Unit 3: Wire trigger to fire on signal INSERT**

**Goal:** Every new signal automatically runs `verify_signal_position_audit`

**Requirements:** R1

**Dependencies:** Unit 2

**Files:**
- Create: `supabase/migrations/20260327_add_signal_verification_trigger.sql`

**Approach:**
```sql
CREATE TRIGGER on_signal_insert_verify
  AFTER INSERT ON signals
  FOR EACH ROW
  WHEN (NEW.is_verified = false AND NEW.is_active = true)
  EXECUTE FUNCTION verify_signal_position_audit(NEW.id);
```

**Note:** The trigger passes the `NEW.id` as an argument. The function signature must accept a UUID.

**Patterns to follow:**
- Existing trigger patterns in `supabase/migrations/` (check for examples)

**Test scenarios:**
- New signal INSERT → trigger fires → verification runs
- Signal INSERT with `is_verified = true` already → trigger skips (via WHEN condition)

**Verification:**
- Trigger exists in database after migration
- New signal INSERT causes verification function to be called

- [ ] **Unit 4: Create `verifySignal` TypeScript wrapper (optional, for manual triggering)**

**Goal:** Expose `verifySignal(signalId)` as a callable function for manual or batch verification

**Requirements:** R4 (idempotent — can be re-run)

**Dependencies:** Unit 2

**Files:**
- Create: `src/lib/signals/verifySignal.ts`

**Approach:**
- Wraps the Postgres function via `serviceClient.rpc("verify_signal_position_audit", { signal_id })`
- Idempotent: re-running sets `verified_at` to `now()` again but doesn't create duplicates

**Patterns to follow:**
- `src/lib/copy-trading/executor.ts` for service client usage

**Test scenarios:**
- Calling `verifySignal(validId)` with matching position → returns `{ success: true, verified: true }`
- Calling `verifySignal(validId)` without matching position → returns `{ success: true, verified: false }`
- Calling `verifySignal(invalidId)` → throws or returns error

**Verification:**
- Function can be imported and called from server-side code
- Result matches the database state

## System-Wide Impact

- **Interaction graph:** Signal INSERT now triggers verification. No changes to the signal creation API surface (the trigger is internal).
- **Error propagation:** If the trigger function throws, the signal INSERT still succeeds (AFTER INSERT trigger can't rollback the insert). Errors are logged but non-fatal.
- **State lifecycle risks:** If a signal is verified but the Plaid position is later corrected/deleted, the signal stays verified. Retroactive un-verification is deferred.

## Risks & Dependencies

- **Risk:** The `AFTER INSERT` trigger runs synchronously — if the verification Postgres function is slow, it adds latency to every signal INSERT. Mitigate: keep the function fast (single indexed lookup).
- **Risk:** The 24-hour window may be wrong — could miss same-day positions that Plaid hasn't synced yet. Mitigate: make the window configurable via an environment variable or constants file.
- **Dependency:** Units 1 → 2 → 3 are sequential. Unit 4 is independent.

## Documentation / Operational Notes

- Document the `position_audit` verification method in the signals table comment
- Add `verified_method` to the signals table documentation
- The verification is automatic for all new signals — no UI needed to trigger it

## Sources & References

- **Ideation:** [docs/ideation/2026-03-27-open-ideation.md](docs/ideation/2026-03-27-open-ideation.md)
- Related code: `src/lib/copy-trading/executor.ts`, `src/lib/webhook/handlers/plaid.ts`
