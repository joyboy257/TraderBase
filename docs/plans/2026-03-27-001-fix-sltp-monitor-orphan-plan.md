---
title: "fix: SLTP Monitor Orphan Detection + Reconciliation"
type: fix
status: active
date: 2026-03-27
origin: docs/ideation/2026-03-27-open-ideation.md
deepened: 2026-03-27
---

# fix: SLTP Monitor Orphan Detection + Reconciliation

## Overview

Fix two bugs in the SLTP monitor pipeline: (1) `monitor.ts` uses an INNER JOIN that silently skips all monitors with `position_id: null`, and (2) no mechanism exists to detect or notify users when monitors are permanently orphaned due to a missed Plaid webhook.

## Problem Frame

**Bug A — Silent skip:** `monitor.ts:178` queries `positions!inner(id, ...)` which silently excludes every row where `position_id IS NULL`. Every orphaned monitor is permanently excluded from every cron cycle — no error, no log.

**Bug B — Orphan source:** `handleSyncUpdatesAvailable` (plaid.ts:71-82) links monitors to positions when `TRANSACTIONS_SYNC` fires. But `handleItemError` (plaid.ts:86-121) deactivates the brokerage connection FIRST — before any sync webhook arrives — orphaning all monitors created between the last successful sync and the ITEM_ERROR.

## Requirements Trace

- R1. All active SLTP monitors must be evaluated every cron cycle, regardless of `position_id` state
- R2. Orphaned monitors (position_id null + no Plaid sync in X minutes) must be surfaced as `orphaned` status and user must be notified
- R3. Orphaned monitors that are later linked via Plaid sync must resume normal evaluation automatically

## Scope Boundaries

- Does NOT add a new Plaid re-sync mechanism (orphaned monitors are surfaced, not auto-healed)
- Does NOT build the SLTP feedback loop (leader risk score) — depends on this fix
- Does NOT change the `evaluateTrailingStop` function logic

## Key Technical Decisions

- **Join type:** Change `positions!inner` to `positions()` LEFT JOIN — orphaned rows are returned but cannot fire orders until linked
- **Orphaned status:** Add `orphaned` as a new `sltp_monitors.status` value — distinct from `active`, `sl_triggered`, `tp_triggered`, `trailing_triggered`
- **Watchdog threshold:** 15 minutes — monitors with null `position_id` for >15 minutes are marked orphaned
- **Notification:** Reuse the notifications table from the Brokerage Deactivation Notification plan (Unit 4 in this cycle)

## Open Questions

### Resolved During Planning

- **Q: How do we distinguish orphaned from "waiting for first sync"?** A: Monitors created with `position_id: null` are expected. Only mark orphaned if the Plaid connection is `is_active = false` AND `position_id` is still null after the threshold.
- **Q: What triggers the orphan check?** A: Extend the existing SLTP cron job (vercel.json `process-sltp`) to also run orphan detection — no new cron needed.

### Deferred to Implementation

- Exact SQL for the orphan detection UPDATE query (depends on actual schema column types)
- Whether to mark orphaned monitors with `position_id` set by a late-arriving Plaid sync as `active` again (assume yes — the existing `handleSyncUpdatesAvailable` link logic will overwrite)

## Implementation Units

- [ ] **Unit 1: Add `orphaned` status to `sltp_monitors` schema**

**Goal:** Extend the status enum to include `orphaned` so orphaned monitors are distinct from `active`

**Requirements:** R2

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/20260327_add_sltp_orphaned_status.sql`

**Approach:**
```sql
-- Add orphaned as a new status value if using enum
ALTER TYPE sltp_status ADD VALUE IF NOT EXISTS 'orphaned';
-- Or if status is a text check constraint, the migration adds it to the check
```

**Test scenarios:**
- `SELECT 'orphaned' WHERE 'orphaned' = ANY(enum_range(NULL::sltp_status))` succeeds
- Existing rows with `status = 'active'` are unaffected

**Verification:**
- Migration applies without error on a fresh Supabase instance
- Existing `active` monitors continue to have `status = 'active'`

- [ ] **Unit 2: Fix INNER JOIN → LEFT JOIN in monitor.ts**

**Goal:** Ensure all active monitors are returned by the query, not silently skipped when `position_id` is null

**Requirements:** R1

**Dependencies:** None (self-contained change)

**Files:**
- Modify: `src/lib/sltp/monitor.ts`

**Approach:**
- Change `positions!inner(id, quantity, brokerage_connection_id)` to `positions(id, quantity, brokerage_connection_id)` (PostgREST LEFT JOIN syntax)
- Update the TypeScript type assertion to handle `positions: { ... } | null` — null positions must not cause runtime errors when accessing `position.quantity`
- When `position_id` is null: skip order placement (can't place an order without a linked position), but still update trailing high/low state

**Patterns to follow:**
- Existing `sltp_monitors` query pattern in `monitor.ts:172-183`
- `plaid.ts:71-82` shows how `position_id` gets linked — follow same null-guard pattern

**Test scenarios:**
- Monitor with `position_id: null` is returned by the query and processed for trailing state
- Monitor with `position_id: null` does NOT fire SL/TP orders (no position to close)
- Monitor with valid `position_id` continues to fire SL/TP as before

**Verification:**
- `runMonitorCycle()` with a null-position monitor returns `processed: 1, triggered: 0` without error
- Ticker price update is still written to the orphaned monitor's `trailing_high`/`trailing_low`

- [ ] **Unit 3: Add orphan detection to the SLTP cron**

**Goal:** Mark monitors as `orphaned` if `position_id` is still null after 15 minutes on an inactive brokerage connection

**Requirements:** R2

**Dependencies:** Unit 1 (orphaned status must exist)

**Files:**
- Modify: `src/lib/sltp/monitor.ts` — add `detectOrphanedMonitors()` function
- Modify: `vercel.json` — confirm existing cron schedule covers orphan detection (it should already run every 30 min)

**Approach:**
```typescript
// Pseudocode — directional guidance
async function detectOrphanedMonitors(thresholdMinutes: number = 15) {
  // Find monitors where:
  // - status = 'active'
  // - position_id IS NULL
  // - created_at < NOW() - INTERVAL '15 minutes'
  // - brokerage connection is_active = false
  // UPDATE status to 'orphaned'
}
```

**Patterns to follow:**
- `plaid.ts:86-120` pattern for detecting `is_active = false` brokerage connections
- Existing cron pattern in `vercel.json` for SLTP processing

**Test scenarios:**
- Monitor with null position_id on active connection is NOT marked orphaned (still waiting for sync)
- Monitor with null position_id on inactive connection older than 15 min IS marked orphaned
- Monitor already `orphaned` is not re-marked

**Verification:**
- After running `detectOrphanedMonitors()`, correct monitors have `status = 'orphaned'`
- No monitors with valid `position_id` are affected

- [ ] **Unit 4: Notify user when monitors are orphaned**

**Goal:** User receives a notification when their SLTP monitors are orphaned

**Requirements:** R2

**Dependencies:** Unit 1 (status value), notifications table from plan #4 (Brokerage Deactivation Notification)

**Approach:** After marking monitors as orphaned in Unit 3, insert a notification row for the user. Notification text: "Your stop-loss/take-profit monitors for [TICKER] are waiting for a brokerage sync and may not trigger. Please reconnect your brokerage account."

**Note:** This unit depends on the `notifications` table from the Brokerage Deactivation Notification plan. If that table doesn't exist yet, defer this unit.

**Verification:**
- After orphan detection runs, user has a notification in the notifications table

## System-Wide Impact

- **Interaction graph:** `handleSyncUpdatesAvailable` (plaid.ts) will now correctly link orphaned monitors if a late Plaid sync arrives — the existing link logic at `plaid.ts:71-82` already handles `is("position_id", null)` conditions
- **State lifecycle risks:** If a monitor is marked orphaned but the Plaid sync arrives the same minute, the link logic will overwrite `status` back to `active` — this is correct behavior
- **API surface parity:** No public API changes

## Risks & Dependencies

- **Risk:** Changing `!inner` to left join in PostgREST may affect how null positions are serialized. Verify the `.eq("position_id", ...)` filter on line 246 still works when `position_id` is null.
- **Risk:** If the `sltp_status` enum already has many values, adding `orphaned` must use `ADD VALUE IF NOT EXISTS` to be idempotent-safe.
- **Dependency:** Unit 4 depends on the notifications table from the Brokerage Deactivation Notification plan. If not available, defer to a follow-up.

## Documentation / Operational Notes

- The `orphaned` status should be documented in the SLTP monitor state machine diagram (add if not exists)
- No changes to vercel.json cron schedule needed — orphan detection runs in the same 30-min cycle

## Sources & References

- **Ideation:** [docs/ideation/2026-03-27-open-ideation.md](docs/ideation/2026-03-27-open-ideation.md)
- Related code: `src/lib/sltp/monitor.ts`, `src/lib/webhook/handlers/plaid.ts`
