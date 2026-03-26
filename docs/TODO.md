# TraderBase — Remaining Work Items

Generated from codebase review (2026-03-26).

---

## P0 — Must Fix Before Production

All P0 items have been resolved as of commit `113b1c2`.

### [x] ~~Plaid access tokens stored plaintext~~
**Fixed:** AES-256-GCM encryption in `src/lib/crypto.ts`. `exchange-token` route encrypts before storing. `lib/plaid/client.ts` auto-decrypts before SDK calls.

### [x] ~~Webhook endpoint has no authentication~~
**Fixed:** `POST` handler now validates `plaid-verification` JWT header via `verifyWebhookToken()`. Raw body used for signature verification.

### [x] ~~Settings page — 5 non-functional buttons~~
**Fixed:** `ProfileForm`, `BrokerageConnectionCard`, `CopySettingsForm`, `DeleteAccountButton` components + server actions in `src/app/actions/settings.ts`.

### [x] ~~Follow/Unfollow/Copy/Signal buttons across pages~~
**Fixed:** `/api/follow` route, `FollowButton`, `CopySignalButton`, `FollowButtonGrid` components wired across all listed pages.

---

## P1 — High Priority

All P1 items resolved as of commit `c792560`.

### [x] ~~Copy trading executor is MVP stub~~
**Fixed:** `executeCopyTrade` now decrypts token, looks up `security_id` via `getInvestmentHoldings`, places real market orders via `postInvestmentOrder()` (direct axios call to `/investments/orders/post`). BUY/SELL with correct quantities. Status updated to 'executed' or 'failed'.

### [x] ~~Webhook type wrong~~
**Fixed:** Already resolved in prior review pass (INVESTMENTS check).

### [x] ~~Chat realtime filter — SQL injection~~
**Fixed:** Already resolved in prior review pass (roomId state + parameterized filter).

### [x] ~~processAllFollowers — duplicate copied_trade rows~~
**Fixed:** `executeCopyTrade` now checks for existing processed copy before executing. Migration adds `idempotency_key` unique index. Returns early if `(signal_id, user_id)` already exists with non-failed status.

### [x] ~~Polygon getQuote — stale data~~
**Fixed:** `getQuote` now calls `getLastTrade()` (`/v3/last-trade/{ticker}`) for real-time price and `getPreviousClose()` (`/v2/aggs/ticker/{ticker}/prev`) for accurate change calculation.

---

## P2 — Medium Priority

### [x] ~~Polygon WebSocket reconnect — no exponential backoff~~
**Fixed:** Exponential backoff with jitter added. `delay = min(baseDelay * 2^attempt + random_jitter, maxDelay)`. Cap at 30s. Resets attempt counter on successful reconnect.

### [ ] `copied_trades` table — SQL needs to be run in Supabase
> Migration file created at `supabase/migrations/20260326_add_copied_trades_idempotency.sql`. The idempotency_key column + unique index must be applied to the Supabase project.

### [ ] Test infrastructure — zero test files
**Severity:** P2 — quality/risk
> The project has no Jest/Vitest configuration and no test files.
>
> **Action:** `npm install -D vitest @vitejs/plugin-react`, configure in `vite.config.ts`, write tests for executor.ts, webhooks/plaid/route.ts, transformHoldingsToPositions, usePolygonPrices.

### [x] ~~Signal rationale XSS risk~~
**Fixed:** `signal.rationale` now escaped with `.replace(/</g, "&lt;").replace(/>/g, "&gt;")` before rendering.

### [x] ~~Copy trading rate limiting~~
**Fixed:** `src/lib/rate-limit.ts` — in-memory rate limiter (10 exec/min per user). Applied to `executeCopyTrade` and `processAllFollowers`.

### [x] ~~Delete Account — no confirmation dialog~~
**Fixed:** `DeleteAccountButton` now has a two-step confirm ("Are you sure?") before calling `deleteAccount`.

### [x] ~~Profile update — no server-side validation~~
**Fixed:** `saveProfile` already validates username 3-30 chars alphanumeric+underscore, bio max 500 chars.

---

## P3 — Lower Priority / Advisory

### [ ] Middleware runs on every request including /api/*
**File:** `src/lib/supabase/middleware.ts`
> `getUser()` is called on every matched route including `/api/*`. Some API routes (webhook) have their own auth and don't need the session cookie parsed.
>
> **Fix:** Add `/api/` to the matcher exclusion pattern, or skip `getUser()` for routes starting with `/api/`.

---

### [ ] Dead code — tickersRef in usePolygonPrices
**File:** `src/hooks/usePolygonPrices.ts:17`
> `const tickersRef = useRef(tickers)` is set but never read. Dead code.
>
> **Fix:** Remove the `tickersRef` declaration and the `eslint-disable` comment.

---

### [ ] PlaidLink component — unused abstraction
**File:** `src/components/plaid/PlaidLink.tsx`
> Exported component only used by `BrokerageConnector`. Both share similar logic.
>
> **Fix:** Either remove `PlaidLink` (if truly unused) or consolidate.

---

### [ ] Copy ratio check dead from one call path
**File:** `src/lib/copy-trading/executor.ts:92`
> `if (typedFollow.copy_ratio <= 0)` can never be true when called from `processAllFollowers` (query filters `copy_ratio > 0`). The check is only meaningful if `executeCopyTrade` is called directly.
>
> **Fix:** Keep the check (it's a valid guard for direct calls), but add a comment noting the query already filters this.

---

### [ ] POLYGON_API_KEY not in .env.local
> Polygon WebSocket and REST calls silently no-op because the API key is not set.
>
> **Action:** Add `POLYGON_API_KEY` to `.env.local` for development.

---

### [ ] Middleware auth protection gap
**File:** `src/middleware.ts`
> `/traders` and `/traders/[username]` are not in the auth-protected route list but show sensitive trading data.
>
> **Fix:** Decide if trader profiles should be public (current behavior) or require auth. Update matcher accordingly.

---

## Done (2026-03-26)

- [x] Dashboard portfolio value: multiply by quantity (was summing only `current_price`)
- [x] Division-by-zero guards on `entry_price === 0` in dashboard and signals pages
- [x] Settings page: `user!.id` null assertion — added guard
- [x] Auth ownership in `triggerCopyTradingForSignal` — added ownership check
- [x] Open redirect in callback — validate `next` against `SAFE_PATHS` allowlist
- [x] Chat SQL injection — replaced subquery template interpolation with `roomId` state + parameterized filter
- [x] Chat XSS — escape `<` `>` in message content
- [x] Webhook silent swallowing — added `.catch()` handlers, errors are now logged
- [x] Triplicated position sync logic — extracted `transformHoldingsToPositions()` in `lib/plaid/client.ts`
- [x] Dashboard sequential DB queries — parallelized with `Promise.all`
- [x] Signals page sequential queries — parallelized
- [x] `getQuote` — switched to `/range/1/day/1/now` for current price data
