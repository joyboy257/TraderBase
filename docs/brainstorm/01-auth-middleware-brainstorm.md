# Brainstorm: Auth Middleware on `/traders`

## What's Broken

**Middleware gap — `/traders` pages are not in the protected route list.**

`src/lib/supabase/middleware.ts` checks auth and redirects to `/login` for `/dashboard`, `/feed`, `/signals`, `/chat`, `/portfolio`, and `/settings`. `/traders` and `/traders/[username]` are missing from this list.

Additionally, the Next.js middleware `matcher` in `src/middleware.ts` excludes all `api/*` routes:
```
"/((?!_next/static|_next/image|favicon.ico|api/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
```
So `/api/follow` is not covered by middleware at all.

**Actual state of `/api/follow`:** The route handler (`src/app/api/follow/route.ts`) does call `getUser()` and returns `401 Unauthorized` if not authenticated (lines 7 and 40). So the API itself is not fully open — unauthenticated calls get a 401. However, the UX is broken: an unauthenticated user browsing `/traders` sees follow buttons that appear clickable but silently fail with a 401 in the console.

**The `FollowButtonGrid` component on `/traders`:** Likely makes the API call client-side without checking auth state first, resulting in noisy 401 errors or silent failures for unauthenticated users.

## What the Fix Looks Like

1. **Add `/traders` routes to the protected route list** in `src/lib/supabase/middleware.ts`:
   - Add `request.nextUrl.pathname.startsWith("/traders")` to the existing protected block (lines 33-41).
   - This covers both `/traders` and `/traders/[username]` with one condition.

2. **For `/api/follow`:** The route handler already guards with `getUser()` + 401. The remaining gap is UX — the `FollowButtonGrid` component should detect unauthenticated state and either show a "Login to follow" prompt or prevent the API call entirely. This is a client-side fix in the component, not a middleware change.

3. **Optional improvement — add `/api/follow` to middleware matcher** (removing `api/.*` exclusion and instead explicitly excluding static assets): This would let middleware catch unauthenticated API calls before they hit the handler. However, since the handler already returns 401, this is defense-in-depth rather than a fix.

## Edge Cases

- **`/traders` as a landing/SEO page:** If there's a design decision to make `/traders` publicly viewable (like a marketing page listing top traders), the redirect-to-login is a product choice, not a bug. Current ideation doc frames it as a security gap, so the assumption is it should be protected.
- **OAuth callback URLs:** After magic link or OAuth login, Supabase redirects back. Ensure the middleware allows the callback flow to complete without redirecting back to login.
- **SSR on `/traders` page:** The page server-renders with `createClient()` and calls `getUser()`. If middleware redirects before the page renders, that's clean. If middleware allows the render and the page detects no user, the `FollowButtonGrid` sees `userId` as `""` — currently it renders follow buttons for every trader regardless.
- **Concurrent sessions / token expiry:** If a user's session expires mid-use, `getUser()` on the page will return null. The middleware redirect handles this on the next navigation. The `/api/follow` handler's own auth check is the real guard for API calls.
- **`/api/follow` is excluded from matcher — is this intentional?** If there's a deliberate reason (e.g., webhooks hitting an API route), removing `api/.*` from the exclusion could break that. Safer to leave the exclusion and rely on the handler's own auth check.

## Open Questions

- Should `/traders` be fully public (no auth required to browse) with follow buttons gated only at the API/component level? Or should the page itself redirect to login?
- Does the `FollowButtonGrid` have any auth-gated behavior currently, or does it blindly call the API?
- Are there other trader-adjacent routes missing from middleware (e.g., `/traders/[username]/signals`)?
