---
title: "feat: iOS Copy Trading API Route + Service"
type: feat
status: active
date: 2026-03-27
origin: docs/ideation/2026-03-27-open-ideation.md
deepened: 2026-03-27
---

# feat: iOS Copy Trading API Route + Service

## Overview

Create a public REST endpoint that wraps `executeCopyTrade()` for the iOS app, and implement the iOS-side service that calls it. The iOS app currently has no mechanism to trigger a copy trade — the mobile app cannot copy traders at all.

## Problem Frame

The iOS project has `SignalsService.swift`, `TradersService.swift`, and `PortfolioService.swift` — but **no `CopyTradingService.swift`**. The mobile app cannot copy traders. The fix requires both a backend API route (to expose `executeCopyTrade` as a public endpoint) and an iOS service.

## Requirements Trace

- R1. iOS app can initiate a copy trade via `POST /api/copy-trade`
- R2. The API route extracts the authenticated user from the Supabase session token (not a server action context)
- R3. iOS `copySignal(signalId)` returns success/failure with the copied trade ID or error message

## Scope Boundaries

- Does NOT add any new copy trading logic — only wraps existing `executeCopyTrade()`
- Does NOT change the iOS authentication flow — `SupabaseClientManager.shared.client` already handles session
- Does NOT add Plaid order placement from iOS directly — all Plaid calls stay server-side

## Key Technical Decisions

- **Auth:** Next.js Route Handler (`/api/copy-trade/route.ts`) receives the Supabase session token from the iOS client via `Authorization: Bearer <token>` header. Uses `createServerClient` with the user's token to extract `user_id`. This is the same pattern used by other API routes in the codebase.
- **iOS URL:** The iOS service calls `POST <SUPABASE_URL>/functions/v1/copy-trade` — note this is the existing Supabase Edge Function convention, but since we're using Next.js API route instead, iOS should call `POST <NEXT_PUBLIC_APP_URL>/api/copy-trade`
- **Idempotency:** The existing `executeCopyTrade` idempotency key (3-part: signal_id:follower_id:brokerage_connection_id) handles duplicate protection — no additional idempotency needed at the API layer

## Open Questions

### Resolved During Planning

- **Q: Should we use a Supabase Edge Function or a Next.js API route?** A: Next.js API route. The web app uses server actions; creating a new Edge Function adds unnecessary infrastructure. The Next.js API route can call `executeCopyTrade` directly.
- **Q: What auth header does iOS send?** A: iOS Supabase client stores the session token in the access token. `SupabaseClientManager.shared.client.session.accessToken` is the Bearer token.

### Deferred to Implementation

- Whether to validate the `signalId` exists and is active before calling `executeCopyTrade` (the executor handles this, so no pre-validation needed)
- iOS error handling UI (out of scope — just return the result)

## Implementation Units

- [ ] **Unit 1: Create `POST /api/copy-trade` route**

**Goal:** Public REST endpoint that accepts `{ signalId: string }` and calls `executeCopyTrade`

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Create: `src/app/api/copy-trade/route.ts`

**Approach:**
1. Extract Bearer token from `Authorization` header
2. Create Supabase server client with the user's token
3. Get `user_id` from the session
4. Parse `signalId` from request body
5. Call `executeCopyTrade(userId, signalId)`
6. Return JSON result with appropriate status codes (200 success, 400 bad request, 401 unauthorized, 500 internal error)

**Patterns to follow:**
- Existing API route pattern in `src/app/api/` directory
- Auth token extraction pattern from other Route Handlers in the codebase
- `src/lib/copy-trading/executor.ts` for the `executeCopyTrade` signature

**Test scenarios:**
- Request with valid auth token and signalId → returns `{ success: true, copied_trade_id: "..." }` or `{ success: false, error: "..." }`
- Request without auth token → returns 401
- Request with invalid signalId → returns `{ success: false, error: "Signal not found or inactive" }`
- Request when user has no brokerage connected → returns `{ success: false, error: "No active brokerage connection" }`

**Verification:**
- `POST /api/copy-trade` with valid auth returns correct JSON shape
- 401 returned when Authorization header is missing or invalid

- [ ] **Unit 2: Create iOS CopyTradingService**

**Goal:** Swift service that iOS views can call to initiate a copy trade

**Requirements:** R3

**Dependencies:** Unit 1 (API route must exist)

**Files:**
- Create: `ios/TraderBase/Core/Services/CopyTradingService.swift`

**Approach:**
```swift
class CopyTradingService {
    private let client = SupabaseClientManager.shared.client

    func copySignal(signalId: String) async throws -> CopyTradeResult {
        // Build request to POST /api/copy-trade
        // Include Authorization: Bearer <accessToken>
        // Body: { "signalId": signalId }
        // Parse response as CopyTradeResult
    }
}
```

**Patterns to follow:**
- `SignalsService.swift` for Swift Supabase client usage patterns
- `TradersService.swift` for async/await service method pattern
- `PortfolioService.swift` for error handling in service layer

**Test scenarios:**
- `copySignal(signalId: "valid-id")` with authenticated user and connected brokerage → returns success
- `copySignal(signalId: "invalid-id")` → returns error from server
- `copySignal()` when not authenticated → returns 401

**Verification:**
- Swift compiles with new service
- Method signature matches expected async/await pattern used by other iOS services
- Copy button in iOS UI can wire up to this service

## System-Wide Impact

- **Interaction graph:** No new callbacks or observers. The API route calls the existing `executeCopyTrade` which handles all downstream effects (copied_trades table insert, Plaid order, sltp_monitors insert).
- **Error propagation:** All errors from `executeCopyTrade` are returned as JSON. No new error types introduced.
- **API surface parity:** Only one new public endpoint added. Other API routes are unaffected.

## Risks & Dependencies

- **Risk:** If the Next.js app is deployed at a different URL than the iOS expects (e.g., custom domain vs `.vercel.app`), the iOS URL hardcoded in the service will break. Mitigate: use `NEXT_PUBLIC_APP_URL` environment variable.
- **Risk:** Exposing `executeCopyTrade` as a public API route requires the auth check to be robust. The executor also has internal rate limiting — ensure the API route doesn't bypass it.

## Documentation / Operational Notes

- Add `NEXT_PUBLIC_APP_URL` to iOS `Config.swift` or environment configuration
- The iOS `copySignal` method should be called from a "Copy" button on the Signal detail view — wiring the UI is out of scope but the service interface should be ready for it

## Sources & References

- **Ideation:** [docs/ideation/2026-03-27-open-ideation.md](docs/ideation/2026-03-27-open-ideation.md)
- Related code: `src/lib/copy-trading/executor.ts`, `ios/TraderBase/Core/Services/SignalsService.swift`
