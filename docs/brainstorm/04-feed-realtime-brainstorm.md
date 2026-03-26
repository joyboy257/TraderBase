# Brainstorm: Feed Like/Comment + Realtime Signal Rows

## What's Broken

**Feed page** (`src/app/(app)/feed/page.tsx`):
- Like and comment buttons are plain `<button>` elements with zero `onClick` handlers.
- Counts (`post.comments_count`, `post.likes_count`) are baked in from the initial server fetch — they never update.
- No API routes exist for liking, unliking, or commenting on feed posts.

**Signals page** (`src/app/(app)/signals/page.tsx`):
- Both feed and signals are full Server Components — no client-side context, no Realtime subscription.
- Data is fetched once on request via `createClient()` (server-side); no Postgres Changes subscription exists anywhere in the codebase.

**Supabase client setup:**
- `client.ts` exposes a plain browser client via `createBrowserClient` — ready for Realtime but never used.
- No `supabase.realtime` channel usage found in any file.

---

## What the Fix Looks Like

### Like/Comment Buttons (Feed)

Two problems: no click handler, no counts update. Both require:

1. **New Server Actions** (not API routes — cleaner with App Router):
   - `toggleLike(postId)` — `UPSERT INTO likes (user_id, post_id) VALUES (...) ON CONFLICT DO NOTHING`; returns new count.
   - `addComment(postId, content)` — `INSERT INTO comments ...`; returns new count.
   - `deleteComment(commentId)` — `DELETE FROM comments ...`.

2. **Client wrapper component** for the feed card (or a `useFeed` hook):
   - Wraps the feed in a `ClientComponent` that owns the Realtime channel.
   - Passes `onLike`, `onComment` callbacks down to buttons.
   - **Optimistic UI**: update counts locally immediately on click, revert on error.

3. **Optimistic update pattern**:
   ```
   click → local state++ immediately → server action → on success: confirm; on failure: revert + toast
   ```

### Realtime Signal Rows (Signals Page)

- Subscribe to `signals` table Postgres Changes (INSERT only — `postgres_changes({ event: 'INSERT', table: 'signals' })`).
- New rows prepend to the local signal list state.
- No need to re-subscribe on route changes if wrapped in a layout-level provider.

---

## Realtime Pattern to Use

**Postgres Changes** (row-level) — not Broadcast.

| Channel | Event | Payload | Use case |
|---|---|---|---|
| `postgres_changes` on `signals` | INSERT | full new row | New signal row appears live |
| `postgres_changes` on `likes` | INSERT / DELETE | `{ post_id, user_id }` | Feed like counts update |
| `postgres_changes` on `comments` | INSERT / DELETE | comment row | Feed comment counts update |

**Channel naming convention**: `feed:{post_id}` scoped channels are overkill — broadcast counts globally per post instead.

**Subscription lifecycle**: Use a client component at the route level (`"use client"`). Subscribe on `useEffect` mount, unsubscribe on unmount. `onUnsubscribe` handles cleanup automatically.

**Reconnect strategy**: Supabase JS client v2 handles reconnect internally with exponential backoff. No manual reconnect logic needed unless the client is manually instantiated. Ensure the component re-subscribes on re-mount (handled by React `useEffect`).

---

## Edge Cases

- **Duplicate events**: Supabase Realtime can fire the same Postgres change event more than once in edge cases. Deduplicate by `signal.id` / `like.id` on the client before inserting into local state.
- **Optimistic mismatch**: If an action succeeds server-side but the realtime event arrives before the server confirms, the count could double-apply. Fix: use the realtime event as the source of truth for counts, not the action return value.
- **Authenticated-only actions**: Like/comment require auth. If the user is not logged in, buttons should redirect to login or show a toast — not silently fail.
- **Feed page Server Component**: The feed page itself is a Server Component. A `"use client"` sub-tree must own the realtime subscription and interactive state. The Server Component can still do the initial data fetch and pass data as props.
- **Signals page pagination**: Realtime INSERT only adds new rows. If the page is paginated (shows top 50), the new row may not appear if it's not in the top 50. Strategy: prepend to local list, cap at 50 on client.
- **Empty states**: Handle `null` signals/feed posts gracefully — both pages currently do.

---

## Open Questions

1. **Like toggle vs. un-like**: Should a second click remove the like? The ideation doc says "toggle" but the current schema (if `likes` table exists) may not have a unique constraint on `(user_id, post_id)`. Verify or add it.
2. **Comment UI**: The current button just shows a count. Do we need an inline comment thread (expand on click), or does it navigate to a detail page? Affects the component scope significantly.
3. **Which channel for feed counts**: Should the feed subscribe to a global `likes`/`comments` channel and update all visible post counts, or subscribe per-visible-post? Global is simpler but noisier; per-post requires managing N channels.
4. **Supabase Realtime quota**: Realtime connections have limits on free tier. At MVP scale this is fine, but worth noting the `postgres_changes` subscription should be scoped (e.g., only subscribe when tab is visible, `document.visibilitychange`).
5. **RLS policies**: Do `likes` and `comments` tables have RLS policies allowing authenticated inserts/deletes? Must verify before wiring up Server Actions.
6. **Signals feed**: Should it also handle UPDATE/DELETE (signal price updates, signal cancellation)? The ideation doc only mentions INSERT but real-time price changes would be high-value.
