# TraderBase — Remaining Work Items

Generated from codebase review (2026-03-26).

---

## P0 — Must Fix Before Production

### [ ] Plaid access tokens stored plaintext
**Files:** `src/app/api/plaid/exchange-token/route.ts:64`
**Severity:** P0 — critical security
> Field `plaid_access_token_encrypted` is a misnomer. Tokens are stored raw with no encryption. If the database is compromised, all users' brokerage connections are exposed.
>
> **Fix:** Implement AES-256-GCM encryption at rest using a KMS (AWS KMS, Google Cloud KMS, or similar). Encrypt before storing in `brokerage_connections.plaid_access_token_encrypted`. Decrypt in `lib/plaid/client.ts` before passing to Plaid SDK calls.
>
> **Reference:** See `PLAID_ENCRYPTION_KEY` env var placeholder in `schema.sql`.

---

### [ ] Webhook endpoint has no authentication
**File:** `src/app/api/webhooks/plaid/route.ts`
**Severity:** P0 — critical security
> The POST handler receives payloads and trusts `item_id` from the body without cryptographic verification. An attacker who knows a valid `item_id` could trigger fake position syncs or connection deactivations.
>
> **Fix:** Plaid sends a `Plaid-Verification` header containing a signature to verify webhook authenticity. Validate this signature before processing. See Plaid docs: https://plaid.com/docs/webhooks-and-edge-mode/webhook-verification/
>
> **Reference:** `verifyPlaidWebhook()` currently calls `/item/webhook/get` — this verifies the item exists, not that the webhook is authentic. Must use `Plaid-Verification` header JWT validation instead.

---

### [ ] Settings page — 5 non-functional buttons
**File:** `src/app/(app)/settings/page.tsx`
**Severity:** P0 — broken features
> These buttons have no handlers and do nothing when clicked:

| Button | Line | Missing |
|--------|------|---------|
| Save Profile | 110 | Server action or API route to upsert `profiles` |
| Save Copy Settings | 236 | Server action to upsert `follows` copy_ratio/max_position_size |
| Delete Account | 282 | Server action to delete user + cascade data |
| Trash2 (disconnect) | 161 | Wire to existing `DELETE /api/plaid/connections/[id]` |
| Change Avatar | 69 | File upload handler + storage URL update |

> **Fix:** Create server actions or API routes for each. Profile updates can use existing Supabase `upsert`. Account deletion needs `auth.admin.deleteUser()`. Disconnect button needs a client-side `onClick` that calls `DELETE /api/plaid/connections/{conn.id}`.

---

### [ ] Follow/Unfollow/Copy/Signal buttons across pages
**Severity:** P0 — core user flows broken
> These UI elements appear interactive but have no handlers:

| Page | Button | Line | Missing |
|------|--------|------|---------|
| `/traders/page.tsx` | Follow | 169 | `follows` insert/delete + toggle |
| `/traders/[username]/page.tsx` | Follow | 109 | Same as above |
| `/traders/[username]/page.tsx` | Copy Trade | 116 | Trigger `triggerCopyTrade()` server action |
| `/traders/[username]/page.tsx` | Copy (signal row) | 202 | Same |
| `/signals/page.tsx` | Create Signal | 44 | `signals` insert + entry_price current price lookup |
| `/signals/page.tsx` | Copy (row) | 177 | Trigger `triggerCopyTrade()` |
| `/dashboard/page.tsx` | Copy (signal card) | 193 | Trigger `triggerCopyTrade()` |

> **Fix:** Build follow/unfollow API routes and server actions. Wire `triggerCopyTrade` to Copy buttons. Create signal creation modal + API.

---

## P1 — High Priority

### [ ] Copy trading executor is an MVP stub
**File:** `src/lib/copy-trading/executor.ts:127`
> `executeCopyTrade` logs a warning and records `status: 'pending'` but never actually places a brokerage order. The comment says "actual execution requires securities master."
>
> **Fix:** Integrate with Plaid `investmentsOrdersPost` API. Requires looking up `securities_id` from the user's held securities by ticker, then placing a SELL (close) or BUY (open) order. Until then, copy trading is non-functional.

---

### [ ] Webhook type wrong — uses TRANSACTIONS_SYNC instead of INVESTMENTS
**File:** `src/app/api/webhooks/plaid/route.ts:21`
> The condition checks `webhookType === 'TRANSACTIONS_SYNC'` but Plaid Investment product fires `webhook_type: 'INVESTMENTS'`. This means position sync webhooks may never be triggered.
>
> **Fix:** Check `webhookType === 'INVESTMENTS'` (already done in the current fix as `INVESTMENTS`). Verify Plaid sandbox/tested with an investment item webhook to confirm the correct type value.

---

### [ ] Chat realtime filter — needs security verification
**File:** `src/app/(app)/chat/[ticker]/ChatRoom.tsx:68`
> The filter uses `room_id=eq.{roomId}` where `roomId` comes from `useState` (set after room lookup). This avoids the SQL injection but the `rooms.id` from Supabase is a UUID, not user-controlled.
>
> **Fix (pending verification):** Confirm with Plaid/Supabase that the `eq.` filter format is parameterized and not string-interpolated. If in doubt, use a Supabase RPC function or validate `roomId` is a valid UUID with a regex before use.

---

### [ ] processAllFollowers — duplicate signal triggers create duplicate copied_trade rows
**File:** `src/lib/copy-trading/executor.ts:221`
> No idempotency key. If `processAllFollowers(signalId)` is called twice rapidly (duplicate webhook, double server action click), both calls insert `copied_trade` rows without conflict.
>
> **Fix:** Add a unique constraint on `(signal_id, user_id)` in `copied_trades` table, or add an `idempotency_key` column with a unique index. Use `ON CONFLICT DO NOTHING` in the upsert.

---

### [ ] Polygon getQuote — getQuote returns stale data
**File:** `src/lib/polygon/client.ts`
> The `/range/1/day/1/now` endpoint returns the current day's bar, not real-time price. For a ticker that hasn't traded yet today, the price may be yesterday's close.
>
> **Fix:** Use Polygon Trade endpoint (`/v3/last-trade/{ticker}`) for real-time price, or use the WebSocket `T.{ticker}` message `p` (price) field as the authoritative current price and use `getQuote` only for initial hydration.

---

## P2 — Medium Priority

### [ ] Polygon WebSocket reconnect — no exponential backoff
**File:** `src/lib/polygon/client.ts:75`
> Reconnect uses fixed 3-second delay. During a Polygon outage, all clients reconnect simultaneously after exactly 3s — thundering herd problem.
>
> **Fix:** Implement exponential backoff with jitter: `delay = min(baseDelay * 2^attempt + random_jitter, maxDelay)`. Cap at ~30s.

---

### [ ] copied_trades table — SQL not applied to Supabase
> The schema SQL was generated but has not been run in the Supabase project.
>
> **Action:** Run the following in the Supabase SQL editor:
> ```sql
> CREATE TABLE public.copied_trades (
>   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
>   user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
>   signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE,
>   brokerage_connection_id UUID REFERENCES public.brokerage_connections(id) ON DELETE SET NULL,
>   ticker TEXT NOT NULL,
>   action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
>   quantity DECIMAL(12,4) NOT NULL,
>   price DECIMAL(10,2) NOT NULL,
>   executed_at TIMESTAMPTZ NOT NULL,
>   status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed')),
>   error_message TEXT,
>   created_at TIMESTAMPTZ DEFAULT NOW()
> );
> CREATE INDEX idx_copied_trades_user_id ON public.copied_trades(user_id);
> CREATE INDEX idx_copied_trades_signal_id ON public.copied_trades(signal_id);
> ALTER TABLE public.copied_trades ENABLE ROW LEVEL SECURITY;
> CREATE POLICY "Users can view own copied trades" ON public.copied_trades FOR SELECT USING (auth.uid() = user_id);
> CREATE POLICY "Service role can insert copied trades" ON public.copied_trades FOR INSERT WITH CHECK (auth.role() = 'service_role');
> ```

---

### [ ] Test infrastructure — zero test files
**Severity:** P2 — quality/risk
> The project has no Jest/Vitest configuration and no test files. Critical paths (copy trading executor, webhook handlers, position sync) are exercised only in production.
>
> **Fix:** Add Vitest (`npm install -D vitest @vitejs/plugin-react`), configure in `vite.config.ts`, write tests for:
> - `executor.ts`: all error branches (no signal, no follow, no brokerage, qty <= 0, etc.)
> - `webhooks/plaid/route.ts`: mock Plaid payload, verify DB side effects
> - `lib/plaid/client.ts transformHoldingsToPositions()`: edge case (missing security)
> - `usePolygonPrices.ts`: WebSocket message parsing, reconnect behavior

---

### [ ] Signal rationale XSS risk
**File:** `src/app/(app)/traders/[username]/page.tsx:206`
> `{signal.rationale}` is rendered without HTML escaping. A trader who stores `<script>` in their rationale field could execute JS in other users' browsers.
>
> **Fix:** Escape HTML entities before rendering, same as ChatRoom message content fix.

---

### [ ] Copy trading rate limiting
**Files:** `src/app/actions/copy-trading.ts`
> `executeCopyTrade` and `processAllFollowers` have no rate limiting. An attacker or buggy client could spam copy trade triggers.
>
> **Fix:** Add rate limiting middleware (e.g., Upstash Redis or in-memory with `rate-limiter-flexible`) keyed on `user.id`. Cap at ~10 executions per minute per user.

---

### [ ] Delete Account — no confirmation dialog
**File:** `src/app/(app)/settings/page.tsx:282`
> Button deletes immediately on click with no confirmation modal and no CSRF protection.
>
> **Fix:** Add a confirmation dialog (e.g., `<dialog>` or modal) requiring the user to type "DELETE" or confirm before calling the delete action. Add a CSRF token via `serverAction` with `useFormStatus` or a hidden nonce.

---

### [ ] Profile update — no server-side validation
**File:** `src/app/(app)/settings/page.tsx:80-96`
> Username, display name, and bio are accepted without server-side length/content validation. Client-side username sanitization in signup can be bypassed.
>
> **Fix:** Add server-side validation in the profile update server action:
> - username: 3-30 chars, alphanumeric + underscore, unique
> - display_name: max 100 chars
> - bio: max 500 chars

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
