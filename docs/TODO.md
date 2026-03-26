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

### [x] ~~Middleware runs on every request including /api/*~~
**Fixed:** Added `api/` to middleware matcher exclusion pattern in `src/middleware.ts`.

### [x] ~~Dead code — tickersRef in usePolygonPrices~~
**Fixed:** Removed dead `tickersRef` useRef and the `eslint-disable` comment from `usePolygonPrices.ts`.

### [x] ~~PlaidLink component — unused abstraction~~
**Fixed:** Deleted `src/components/plaid/PlaidLink.tsx` (unused; `BrokerageConnector` uses `usePlaidLink` directly).

### [x] ~~Copy ratio check dead from one call path~~
**Fixed:** Added comment in `executor.ts` noting this guard is for direct `executeCopyTrade` calls (processAllFollowers filters `copy_ratio > 0`).

### [x] ~~POLYGON_API_KEY not in .env.local~~
**Fixed:** Added `POLYGON_API_KEY=your_polygon_api_key_here` placeholder to `.env.local`.

### [ ] Middleware auth protection gap — `/traders` pages not protected
**File:** `src/middleware.ts`
> `/traders` and `/traders/[username]` are not in the auth-protected route list but show sensitive trading data.
>
> **Note:** Decide if trader profiles should be public (current behavior) or require auth.

---

## iOS App (TraderBase)

**Status:** Scaffold complete — requires credentials to build

### Setup (blocked on credentials)
- [ ] Run `brew install xcodegen` on your Mac
- [ ] Replace placeholder values in `ios/TraderBase/Core/Supabase/SupabaseClient.swift`:
  - `supabaseURL` → real Supabase project URL
  - `supabaseAnonKey` → real anon key
- [ ] Create App Store app and configure `PRODUCT_BUNDLE_IDENTIFIER` in `project.yml`
- [ ] Set `DEVELOPMENT_TEAM` in `project.yml` (your Apple Developer team ID)
- [ ] Connect Plaid Link SDK for brokerage connection (iOS Swift Package)
- [ ] Integrate Polygon.io iOS SDK for real-time price streaming

### When ready to build
```bash
cd ios
xcodegen generate  # generates .xcodeproj from project.yml
open TraderBase.xcodeproj  # opens in Xcode
# Select iPhone simulator → Run (⌘R)
```

### Project structure
```
ios/
├── project.yml                          # XcodeGen config (defines all targets + packages)
└── TraderBase/
    ├── App/TraderBaseApp.swift          # @main entry, RootView routing
    ├── Core/
    │   ├── Supabase/SupabaseClient.swift # Client singleton + storage driver
    │   ├── Models/                      # User, Signal, Position, Trade, Follow
    │   └── Services/                   # Auth, Signals, CopyTrading, Portfolio, Traders
    ├── Features/
    │   ├── Auth/LoginView.swift         # Magic link + Google OAuth
    │   ├── Dashboard/                   # Portfolio summary + live signals feed
    │   ├── Signals/                     # Filterable signals list
    │   ├── Traders/                     # Trader discovery + profile
    │   ├── Portfolio/                   # Positions / History / Copied tabs
    │   └── Settings/                    # Copy settings, brokerages, profile, notifications
    ├── Components/                      # SharedComponents, Buttons, Cards
    └── Resources/                      # Info.plist, Assets.xcassets
```

### Dependencies (via SPM — declared in project.yml)
- `supabase-swift` (v2.2.0) — Auth + Database client
- `SnapKit` (v5.7.0) — Auto Layout DSL (if UIKit views needed)

### Remaining web backend TODOs
- [ ] Run `copied_trades` idempotency migration in Supabase SQL editor
- [ ] Decide `/traders` auth protection (public or auth-required)
- [ ] Add Vitest test infrastructure to web app

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
