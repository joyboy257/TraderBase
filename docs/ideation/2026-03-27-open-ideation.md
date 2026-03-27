---
date: 2026-03-27
topic: open-ideation
focus: general
---

# Ideation: Open Ideation — TraderBase

## Codebase Context

**Project**: TraderBase — Next.js 14 App Router social copy trading platform
**Stack**: Supabase (auth/realtime/postgres), Plaid (brokerage), Polygon.io (market data), GSAP animations
**Key files**: `src/lib/copy-trading/executor.ts` (433 lines), `src/lib/sltp/monitor.ts`, `src/app/api/webhooks/plaid/route.ts`

### Past Learnings (from 2026-03-26 session)
- Auth middleware, follow API security, onboarding wizard, feed realtime, webhook reliability, idempotency, SLTP automation — all implemented
- `docs/solutions/` does not exist; no ADRs or runbooks

### Ground-Truth Confirmed by Critique Agents
| Claim | Status |
|-------|--------|
| SLTP `position_id: null` orphaned forever if Plaid webhook misses | CONFIRMED — gap is narrower: webhook fires on sync, but outage/ITEM_ERROR orphans monitors |
| iOS `CopyTradingService.swift` calls non-existent edge function | CONFIRMED — `POST /functions/v1/copy-trade` does not exist; web uses server actions |
| `handleItemError()` silently deactivates brokerage, no user notification | CONFIRMED — `plaid.ts:120` only logs |
| `webhook_events` table + DLQ replay already built | CONFIRMED — `webhook_events` table + `/api/admin/webhooks/replay/route.ts` exist |
| SLTP cron + monitor cycle already exist | CONFIRMED — `vercel.json` cron + `runMonitorCycle()` exist |
| `.env.local` properly gitignored | CONFIRMED — `.gitignore` audit confirms |

### Pain Points / Gaps
- Zero test files despite financial transaction logic in `executor.ts`
- iOS app has broken copy-trade service calling non-existent endpoint
- `is_verified` on profiles/signals exists in schema but no verification logic
- `feed_posts`, `chat_rooms` fully provisioned but no active creation UI or users
- Notification infrastructure entirely absent

---

## Ranked Ideas

### 1. SLTP Monitor Orphan Detection + Reconciliation

**Accurate Description:**

Two concrete problems, one fix:

**Problem A (Silent skip bug):** `monitor.ts:178` queries:
```sql
SELECT ... FROM sltp_monitors
  JOIN positions!inner(id, ...) ON ...  -- INNER JOIN
  JOIN signals!inner(id) ON ...
  WHERE status = 'active'
```
`positions!inner` silently excludes every row where `position_id IS NULL`. Every monitor with `position_id: null` is permanently excluded from every cron cycle — no error, no log, nothing. Users believe their SL/TP is armed; it is never evaluated.

**Problem B (Orphan source):** `handleSyncUpdatesAvailable` (plaid.ts:71-82) links monitors to positions when `TRANSACTIONS_SYNC` fires. But `handleItemError` (plaid.ts:86-121) deactivates the brokerage connection FIRST — before any sync webhook arrives — orphaning all monitors created between the last successful sync and the ITEM_ERROR. No watchdog reconciles them.

**Fix:**
1. Change `monitor.ts:178` from `positions!inner(...)` to `positions(...)` (LEFT JOIN) so null-position monitors are at least visible and processed (they'll get price lookups but can't fire orders until linked)
2. Add a `status = 'orphaned'` value to `sltp_monitors` with a watchdog cron that marks monitors as `orphaned` if `position_id` is still null after X minutes
3. Add a notification to the user when their monitors are orphaned (can reuse the brokerage deactivation notification from idea #4)

**Rationale:** Both critique agents flagged this. The INNER JOIN silently skips all orphaned monitors every 30 minutes. Users think they have SL/TP protection. This is a silent financial protection failure with real money consequences.

**Implementation files:**
- `src/lib/sltp/monitor.ts` — fix join type + add orphaned branch
- `supabase/migrations/` — add `orphaned` status value + index on `(status, position_id)`
- New cron endpoint or extend existing SLTP cron for orphan detection

**Confidence:** 75%

**Complexity:** Low (join fix is 1 line; orphan watchdog is a new cron or extended existing)

**Status:** Unexplored

---

### 2. iOS Copy Trading API Route + Service

**Accurate Description:**

The iOS project has `SignalsService.swift`, `TradersService.swift`, and `PortfolioService.swift` — but **no `CopyTradingService.swift`**. iOS currently has no mechanism to trigger a copy trade from the app. The mobile app cannot copy traders at all.

The fix requires both a backend and a frontend component:

**Backend:**
- Create `POST /api/copy-trade/route.ts` that wraps `executeCopyTrade(followerId, signalId)`, extracting the authenticated user from the Supabase session token (not a server action context)

**Frontend (iOS):**
- Create `ios/TraderBase/Core/Services/CopyTradingService.swift` with a `copySignal(signalId: String)` method that calls the new API route
- The existing `SupabaseClientManager.shared.client` handles auth session tokens

**Rationale:** Binary feature gap — iOS cannot do copy trading at all. The existing iOS services (Signals, Traders, Portfolio) already use the Supabase client correctly. CopyTradingService is the missing piece.

**Note:** The learnings summary incorrectly described `CopyTradingService.swift` as "calling a non-existent edge function" — that file doesn't exist yet. The actual gap is: no API route and no iOS service.

**Implementation files:**
- `src/app/api/copy-trade/route.ts` — new API route
- `ios/TraderBase/Core/Services/CopyTradingService.swift` — new iOS service

**Confidence:** 80%

**Complexity:** Low

**Status:** Unexplored

---

### 3. Test Harness for Financial Core Paths

**Accurate Description:**

Zero test files exist. The goal is NOT full coverage — it's regression protection for the 5 paths where bugs move real money.

**executor.ts test cases:**
1. **Winner path** — `INSERT ON CONFLICT DO NOTHING` returns a row; Plaid is called, row updated to `executed`
2. **Loser path** — same INSERT returns nothing; existing row fetched, returned as success without Plaid call
3. **SELL no position** — `holdings.find()` returns undefined; row updated to `failed` with `No position found` error
4. **Plaid API failure** — `postInvestmentOrder` throws; row updated to `failed` with error message
5. **Rate limit exceeded** — `checkRateLimit` returns `allowed: false`; `{ success: false, error }` returned

**monitor.ts test cases:**
1. **BUY SL triggered** — entry $100, SL $95, current $94 → returns `"sl"`
2. **BUY TP triggered** — entry $100, TP $110, current $111 → returns `"tp"`
3. **BUY trailing triggered** — entry $100, activate 5%, trailing 2%, high moves to $107, price drops to $104.86 → returns `"trailing"`
4. **Market closed** — `isMarketOpen()` returns false during test → cycle skipped
5. **Orphaned monitor (position_id null)** — LEFT JOIN now returns the row; monitor should be processed for price but not fire orders until linked

**Infrastructure needed:**
- Vitest setup (`vitest.config.ts`, `package.json` scripts)
- Mock factories: `mockSupabaseClient`, `mockPlaidHoldings({ holdings: [], securities: [] })`, `mockPolygonTrade(price: number)`, `mockRateLimit(allowed: boolean)`
- Tests live in `src/lib/copy-trading/executor.test.ts` and `src/lib/sltp/monitor.test.ts`

**Rationale:** Not "developer comfort" — financial code that moves real money without tests is compounding technical debt. Every PR touching `executor.ts` currently has zero regression protection.

**Implementation files:**
- `vitest.config.ts` — new file
- `src/test-utils/` — mock factories (new directory)
- `src/lib/copy-trading/executor.test.ts` — executor tests
- `src/lib/sltp/monitor.test.ts` — monitor tests
- `package.json` — add `test` script

**Confidence:** 65%

**Complexity:** Medium (setup overhead is one-time)

**Status:** Unexplored

---

### 4. Brokerage Deactivation User Notification

**Accurate Description:**

`handleItemError()` at `plaid.ts:86-121` currently:
1. Deactivates the `brokerage_connections` row (`is_active: false`)
2. Logs a console.warn
3. Has a `// TODO: Notify user via email or in-app notification`

The user gets zero feedback. They only discover the broken connection when copy trading silently stops working.

**Fix:**
1. After deactivating the connection, fetch the `user_id` from the connection record (currently not fetched in `handleItemError`)
2. Insert a notification row into a `notifications` table (new table needed)
3. Broadcast via Supabase Realtime channel for the user
4. Optionally: trigger a Resend email if Resend is configured

**Minimal scope (this idea):**
- Create `notifications` table with: `id, user_id, type, title, body, read, created_at`
- Add `INSERT` to `handleItemError` after deactivation
- Add a Supabase Realtime broadcast on a user-specific channel
- Add a basic notification bell to the app header (minimal UI)

**Note:** Resend email is out of scope for now — Supabase Realtime notification is sufficient to close the gap. Resend can be added later.

**Rationale:** Scoped and concrete. Users with broken brokerage connections have no idea until copy trading fails. One new table + one Supabase broadcast closes the gap.

**Implementation files:**
- `supabase/migrations/YYYYMMDD_add_notifications_table.sql` — new table + RLS
- `src/lib/webhook/handlers/plaid.ts` — add notification INSERT after deactivation
- `src/hooks/useNotifications.ts` — new hook for realtime notification subscription
- `src/components/ui/NotificationBell.tsx` — minimal notification indicator

**Confidence:** 70%

**Complexity:** Low

**Status:** Unexplored

---

### 5. Strategic: is_verified Verification Pipeline

**Accurate Description:**

The `is_verified` field exists on both `profiles` and `signals` tables — but **nothing ever sets it to true**. Every trader and signal in the system is currently `is_verified = false` (or null). The verified badge that appears on trader cards and signal rows is pure theater.

**What "verification" could mean (product decision required):**
- **Option A — Plaid-linked brokerage:** Trader has a linked, active brokerage connection with real positions. Plaid's ITEM_ID confirms real account ownership.
- **Option B — Position audit:** Trader's signals are cross-referenced against actual Plaid position history. Signal is verified if a matching BUY/SELL position was held within the expected timeframe.
- **Option C — Manual review:** Admin marks a trader as verified after KYC-style manual review.
- **Option D — Remove the badge:** If no verification is feasible, remove the `is_verified` badge from the UI entirely and rebrand as "self-reported trade signals."

**What engineering can do now (without product decision):**
- Audit where `is_verified` is displayed (trader cards, signal rows, trader profile pages)
- Add a `verified_at` timestamp and `verified_method` enum to the profiles table to prepare for any of the above options
- Implement Option B (position audit) as the most credible approach: when a signal is created, cross-reference the ticker/action against the user's actual Plaid positions in the last 24 hours. If a matching position exists, auto-verify the signal.

**Minimum viable verification (Option B-lite):**
- On signal creation (`executeCopyTrade` or signal creation API), check if the leader has an active brokerage connection
- Check if the leader's Plaid positions include the signal's ticker with the matching action (BUY/SELL) within the last N hours
- If match: set `is_verified = true` on the signal
- If no match: leave as false (no penalty, just not verified)

**Rationale:** The verified badge is the core trust signal on the platform. If it's hollow, it undermines the entire social proof model. This is the highest-leverage strategic fix.

**Implementation files (MVP verification):**
- `supabase/migrations/YYYYMMDD_add_signal_verification.sql` — add `verified_at`, `verified_method` columns
- `src/lib/signals/verifySignal.ts` — new function to verify a signal against Plaid positions
- Wire `verifySignal()` into the signal creation flow or a background job

**This idea is a prerequisite for:** Any leader quality scoring, the SLTP feedback loop (idea #1 depends on accurate signal data), and the copy trading feedback loop.

**Confidence:** 55%

**Complexity:** High (strategic component); Medium (MVP engineering)

**Status:** Unexplored

---

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Test infrastructure (full extraction + domain layer rewrite) | Agent B: "developer comfort" — but wrong for financial code; partial keep as narrower test harness |
| 2 | Immutable audit ledger | No compliance requirement; serious engineering effort with no stated business need |
| 3 | Webhook DLQ replay | Already built — webhook_events table + replay route exist |
| 4 | WebSocket reliability layer | No documented failures; Polygon client already has reconnect logic |
| 5 | Paper trading shadow mode | No evidence of user demand; premature until SLTP core works |
| 6 | Social graph abuse prevention | No documented abuse; premature until user base exists |
| 7 | Onboarding funnel analytics | Analytics without an action plan is busywork |
| 8 | Unified docs index | Organizational, not product — low leverage |
| 9 | Project identity fix (afterhours vs TraderBase) | Cosmetic; zero business impact |
| 10 | Typed notification platform | Overengineered for a single TODO; narrow implementation (item 4 above) is sufficient |
| 11 | iOS belongs in separate repo | Architectural opinion; fixing the endpoint (item 2) is more valuable |
| 12 | Social features have no audience | Valid strategic question but is a kill/continue decision — add to product owner's plate |
| 13 | SLTP feedback loop (leader risk score) | Premature until SLTP orphan problem (item 1) is fixed; depends on accurate data |

## Session Log
- 2026-03-27: Initial ideation — 32 raw candidates generated across 4 frames, 13 survivors after dedupe, 5 final survivors after adversarial filtering
- 2026-03-27: Refined all 5 survivors with accurate file paths, concrete implementation steps, and confirmed ground-truth
