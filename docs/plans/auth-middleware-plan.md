# Implementation Plan: Auth Middleware Fix for `/traders` Routes

## Overview

There are two distinct issues causing UX noise for unauthenticated users:

1. **Middleware gap** (`src/lib/supabase/middleware.ts` lines 33-41): `/traders` and `/traders/[username]` are not in the protected route list. Unauthenticated users can navigate to these pages and see interactive follow buttons.
2. **No-op API calls** (`FollowButtonGrid.tsx` and `FollowButton.tsx`): Both components blindly call `POST /api/follow` when clicked, even when no user is logged in. The API returns 401, but the component never checks auth state before making the call, resulting in noisy 401 errors with no user-facing feedback.

---

## Part 1: Add `/traders` to Middleware Protected Routes

**File:** `/home/claude/TraderBase/src/lib/supabase/middleware.ts`
**Lines:** 33-41

**Current code:**
```typescript
if (
    !user &&
    (request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/feed") ||
    request.nextUrl.pathname.startsWith("/signals") ||
    request.nextUrl.pathname.startsWith("/chat") ||
    request.nextUrl.pathname.startsWith("/portfolio") ||
    request.nextUrl.pathname.startsWith("/settings"))
  )
```

**Change:** Add `request.nextUrl.pathname.startsWith("/traders")` to the list. This single condition covers both `/traders` (the listing page) and `/traders/[username]` (individual trader profiles), since both paths start with `/traders`.

**New condition:**
```typescript
if (
    !user &&
    (request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/feed") ||
    request.nextUrl.pathname.startsWith("/signals") ||
    request.nextUrl.pathname.startsWith("/chat") ||
    request.nextUrl.pathname.startsWith("/portfolio") ||
    request.nextUrl.pathname.startsWith("/settings") ||
    request.nextUrl.pathname.startsWith("/traders"))
  )
```

**Note on the matcher:** `/api/follow` is excluded from middleware coverage via `api/.*`. The handler already guards with `getUser()` + 401 at lines 7 and 40, so no change needed there. The middleware fix handles unauthenticated users at the page level before they can see follow buttons.

---

## Part 2: Gate `FollowButtonGrid` from Making API Calls When Logged Out

**File:** `/home/claude/TraderBase/src/components/social/FollowButtonGrid.tsx`

**Changes:**

1. Add `useState` to the import:
   ```typescript
   import { useState, useTransition } from "react";
   ```

2. Add `followerId` to the interface:
   ```typescript
   followerId: string;
   ```

3. Destructure `followerId` and add `error` state:
   ```typescript
   export function FollowButton({ leaderId, leaderUsername, isFollowing: initialIsFollowing, followerId }: FollowButtonGridProps) {
     const [isPending, startTransition] = useTransition();
     const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
     const [error, setError] = useState<string | null>(null);
   ```

4. Add auth guard in `handleFollow` before the `startTransition` call:
   ```typescript
   async function handleFollow() {
     if (!followerId) {
       setError("Sign in to follow");
       return;
     }
     startTransition(async () => {
       // ... existing body unchanged
     });
   }
   ```

5. Render error after the button div:
   ```typescript
   {error && <span className="text-xs text-[var(--color-sell)]">{error}</span>}
   ```

6. Update call site in `/traders/page.tsx` (line ~148): Pass `userId` as `followerId`:
   ```typescript
   <FollowButtonGrid
     leaderId={trader.id}
     leaderUsername={trader.username}
     isFollowing={isFollowing}
     followerId={userId}
   />
   ```

---

## Part 3: Gate `FollowButton` from Making API Calls When Logged Out

**File:** `/home/claude/TraderBase/src/components/social/FollowButton.tsx`

**Changes:**

1. Add `useState` to the import:
   ```typescript
   import { useState, useTransition } from "react";
   ```

2. Add `error` state:
   ```typescript
   export function FollowButton({ leaderId, leaderUsername, isFollowing: initialIsFollowing, followerId }: FollowButtonProps) {
     const [isPending, startTransition] = useTransition();
     const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
     const [error, setError] = useState<string | null>(null);
   ```

3. Add auth guard in `handleFollow` before `startTransition`:
   ```typescript
   async function handleFollow() {
     if (!followerId) {
       setError("Sign in to follow");
       return;
     }
     startTransition(async () => {
       // ... existing body unchanged
     });
   }
   ```

4. Render error after the Button:
   ```typescript
   {error && <span className="text-xs text-[var(--color-sell)]">{error}</span>}
   ```

The call site in `/traders/[username]/page.tsx` already passes `followerId={user?.id ?? ""}`, so no change needed there.

---

## Part 4: Note on `CopySignalButton`

`CopySignalButton` already has an auth guard at lines 23-26. No changes needed there.

---

## Files Requiring Changes

| File | Change |
|------|--------|
| `/home/claude/TraderBase/src/lib/supabase/middleware.ts` | Add `/traders` to protected route condition |
| `/home/claude/TraderBase/src/components/social/FollowButtonGrid.tsx` | Add `followerId` prop, `error` state, auth guard |
| `/home/claude/TraderBase/src/app/(app)/traders/page.tsx` | Pass `followerId={userId}` to `FollowButtonGrid` |
| `/home/claude/TraderBase/src/components/social/FollowButton.tsx` | Add `error` state, auth guard |

---

## Verification Checklist

**Middleware redirect:**
1. Open browser in private/incognito mode (no Supabase session cookie)
2. Navigate to `http://localhost:3000/traders` — should redirect to `/login`
3. Navigate to `http://localhost:3000/traders/some_username` — should redirect to `/login`
4. After logging in, navigating to `/traders` should work normally

**Follow button UX:**
5. While logged out, browse to a trader profile — click "Follow" — should show "Sign in to follow" inline, no network call to `/api/follow`, no 401 in console
6. Log in, navigate to `/traders` — follow/unfollow buttons should work normally
7. After following/unfollowing, verify UI updates immediately (optimistic) and `revalidatePath` refreshes server data

**Regression:**
8. Verify `/api/follow` POST/DELETE still return 401 for unauthenticated requests (via curl or network tab)
9. Verify other protected routes (`/dashboard`, `/feed`, `/signals`, etc.) still redirect correctly
