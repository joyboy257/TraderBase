---
date: 2026-03-26
topic: copy-trading-ideation
focus: general improvement
---

# Ideation: AfterHour.com Clone — Copy Trading Platform

## Codebase Context

TraderBase is a Next.js 15 App Router social copy trading platform using Supabase (PostgreSQL + Realtime + Auth), Polygon.io for market data, and Plaid for brokerage linking. The product targets AfterHour.com's core flows: signal sharing, trader discovery/following, real-time feed, copy trading settings, and per-ticker chat.

**Project shape:** TypeScript throughout, App Router with Server Components + Server Actions, Supabase SSR client, `@dnd-kit` for photo grid, GSAP for landing page animations.

**Notable pain points observed:**
- Onboarding wizard has a `handleBrokerageComplete` that is a no-op — users get stuck
- Feed like/comment buttons render but have no click handlers
- Signals feed has no real-time updates
- Follow/unfollow API (`/api/follow`) lacks `leader_id` authorization validation
- Webhook handlers (Plaid) have no retry logic or DLQ — failures are silent
- Copy trade fan-out (`processAllFollowers`) lacks idempotency protection

**Likely leverage points:**
- Supabase Realtime is wired but unused for signals feed — adding it is low-effort/high-impact
- Fixing onboarding flow is a prerequisite for any user retention
- Auth middleware on `/traders` discovery pages closes a security gap
- Idempotency keys on `copied_trades` prevent real financial harm

---

## Ranked Ideas

### 1. Auth middleware on `/traders` page
**Description:** Add `middleware.ts` protection (or reinforce existing) so unauthenticated users are redirected to login when accessing `/traders`, `/traders/[username]`, or any follow/unfollow API call without a valid session.
**Rationale:** Security gap — unauthenticated users can currently browse trader profiles. The follow buttons should require auth and fail gracefully rather than silently doing nothing or making invalid API calls.
**Downsides:** Minor; adds auth overhead to public discovery pages.
**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

---

### 2. Follow API: add `leader_id` authorization check
**Description:** The follow/unfollow API (`POST/DELETE /api/follow`) currently accepts any `leader_id` from the request body without verifying the caller is actually authorized to follow that leader. Add server-side validation that the `leader_id` corresponds to a real, non-self user.
**Rationale:** Security + correctness — prevents malformed requests and ensures follow relationships are valid. Any authenticated user can currently forge a follow request for any other user.
**Downsides:** Requires reading the DB to validate leader exists; adds latency.
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

---

### 3. Onboarding wizard: `handleBrokerageComplete` is a no-op
**Description:** `ConnectBrokerageStep.handleBrokerageComplete` is defined but never called — the function body is empty `{}`. This means the onboarding wizard never dismisses after brokerage connection, trapping users. Both paths (trader/copier) end at `ConnectBrokerageStep` but neither triggers `finishOnboarding`.
**Rationale:** P0 bug — users cannot complete onboarding, blocking all app usage. The fix is straightforward: call `completeOnboardingStep(2)` then `finishOnboarding(path)` when brokerage connects.
**Downsides:** None.
**Confidence:** 95%
**Complexity:** Low
**Status:** Unexplored

---

### 4. Feed like/comment buttons + Realtime signal rows
**Description:** The feed currently has like/comment buttons that render but have no click handlers. Additionally, the signals feed doesn't update in real-time when new signals are posted. Fix the dead like/comment buttons and add Supabase Postgres Changes subscription to live-update signal rows as they appear.
**Rationale:** Core social features are broken — users see non-functional UI. Supabase Realtime is already configured but unused for signals. Realtime row updates are a primary differentiator of the product.
**Downsides:** Realtime subscriptions add Supabase connection overhead; need to handle reconnection gracefully.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

---

### 5. Webhook reliability: retry queue + dead-letter queue
**Description:** Plaid webhooks (and any future webhook sources) have no retry logic or DLQ. If a webhook handler fails (e.g., DB temporarily unavailable), the webhook event is lost. Implement: retry with exponential backoff (3 attempts) then move to DLQ table for manual inspection. A `webhook_events` table tracks state: `pending → processing → completed | failed`.
**Rationale:** Critical for financial operations — missed webhooks mean signals don't fire, positions go stale, copy trades fail silently. This is the foundation of a trustworthy financial product.
**Downsides:** DLQ needs a UI for ops team to inspect/replay events; adds infrastructure complexity.
**Confidence:** 75%
**Complexity:** Medium
**Status:** Unexplored

---

### 6. Idempotency key for `processAllFollowers` fan-out
**Description:** When a trader publishes a signal, `processAllFollowers` fans out copy trade execution to every follower. If the webhook fires twice (Plaid can fire `TRANSACTIONS_SYNC` multiple times for the same data), this could result in double execution of copy trades. Add an idempotency key to the `copied_trades` table (already has the column) to prevent double execution. The idempotency key should be derived from `signal_id + follower_id + brokerage_connection_id`.
**Rationale:** Financial correctness — double execution means users buy/sell twice, losing money or missing profits. The `copied_trades` table already has an `idempotency_key TEXT UNIQUE` column that is not yet populated.
**Downsides:** Need to trace where idempotency key is generated and ensure it's stable across retries.
**Confidence:** 80%
**Complexity:** Low
**Status:** Unexplored

---

### 7. Stop-loss / take-profit automation + trailing stops
**Description:** Implement the core copy trading value proposition: when you copy a trader, automatically set a stop-loss and take-profit based on the signal's `stop_loss` and `take_profit` fields. Add trailing stop support for advanced users. This requires: storing SL/TP prices on signals, a background job to monitor positions against current prices, and Plaid order placement when thresholds are hit.
**Rationale:** This is the primary reason users would use copy trading over manual execution. Without it, the product is just a signal feed with manual trade execution — users still have to do the work themselves.
**Downsides:** Requires Plaid integration to actually place orders; complex to implement correctly (race conditions, order orchestration, partial fills).
**Confidence:** 60%
**Complexity:** High
**Status:** Unexplored

---

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Auth middleware on `/traders` | Security gap but likely already handled by existing middleware; verify before implementing |
| 2 | Test infrastructure (Vitest + Playwright) | High effort, low immediate leverage — better after product-market fit established |
| 3 | Audit log for financial ops | Premature without actual financial transaction volume |
| 4 | Algorithmic trading DSL / strategy builder | Not grounded in current codebase; requires deep domain modeling first |
| 5 | Feature flag system | Nice-to-have; no urgent need right now |
| 6 | Middleware route coverage audit | Interesting but not a user-facing problem |
| 7 | B2B / multi-tenancy foundation | Speculative future scope |
| 8 | Plaid holdings cache | Premature optimization; Plaid not live yet |
| 9 | Discriminated union for CopyExecutionResult | Refactor for its own sake; not a bug |
| 10 | Polygon.io REST parallelization + circuit breaker | No observed performance problem yet |
| 11 | Structured logging with request tracing | High effort, low immediate ROI |
| 12 | `usePolygonPrices` incorrect `isConnected` state | Low urgency; not blocking any user flow |
| 13 | Stale position cache (no TTL) | Known issue but requires Plaid integration to be meaningful |
| 14 | Replace in-memory rate limiter with Upstash Redis | Premature; in-memory is fine for MVP scale |
| 15 | No pessimistic lock on `follows` row during fan-out | Race condition exists but low probability at MVP scale |

---

## Session Log
- 2026-03-26: Initial ideation — 42 raw ideas generated across 5 frames, 7 survivors after adversarial filtering
