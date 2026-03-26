# Brainstorm: Follow API Security Fix

## What's Broken

`POST /api/follow` and `DELETE /api/follow` (`src/app/api/follow/route.ts`) accept any `leader_id` from the request body. The POST handler does one thing right — it blocks self-follow (`leader_id === user.id`) — but has two gaps:

1. **No leader existence check.** `leader_id` can be any UUID. It does not verify the leader exists in `profiles`. This allows request forgery: any authenticated user can "follow" a non-existent user, creating garbage rows.
2. **DELETE has no self-follow guard.** A user could POST `{ leader_id: <someone_else> }` to follow them, then DELETE with the same payload to soft-unfollow. The DELETE handler never checks `leader_id !== user.id`.

## What the Fix Looks Like

Add a leader existence check before the insert/update:

```ts
// After auth check, before the existing-follows query:
const { data: leaderProfile } = await supabase
  .from("profiles")
  .select("id")
  .eq("id", leader_id)
  .single();

if (!leaderProfile) {
  return NextResponse.json({ error: "User not found" }, { status: 404 });
}
```

**DELETE** needs the same guard plus the self-follow check:

```ts
if (leader_id === user.id) {
  return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
}

const { data: leaderProfile } = await supabase
  .from("profiles")
  .select("id")
  .eq("id", leader_id)
  .single();

if (!leaderProfile) {
  return NextResponse.json({ error: "User not found" }, { status: 404 });
}
```

Also add the self-follow guard to DELETE — currently it's only on POST.

## Edge Cases

- **UUID validation:** `leader_id` comes from `request.json()`. If it's not a valid UUID, Supabase will throw a Postgres error (type mismatch on the foreign key check). This should return 400, not 500. Catch it explicitly or validate with a regex before querying.
- **Already-following reactivation (POST):** If `existing` row exists but `is_active=false`, the update reactivates it. This is fine — but verify the unique constraint `(follower_id, leader_id)` catches the race where two concurrent POSTs for the same pair both see no existing row and both try to insert. One will succeed, one will get a constraint violation. That error should be caught and handled gracefully (treat as success).
- **Unfollowing someone you don't follow (DELETE):** The current DELETE silently succeeds even if no row exists. That's arguably fine (idempotent), but if `leader_id` doesn't exist the error is silent. Could return 404 for clarity, but idempotent 200 is also defensible.
- **Banned/deleted leaders:** If a leader deletes their account (CASCADE), the follow row is deleted automatically. No issue there.
- **Leader following back:** No special handling needed — `leader_id` and `follower_id` are just two different user IDs. Two users can follow each other.

## Race Conditions

1. **Concurrent follows (same follower + leader):** Two POSTs race — both see no `existing` row, both try insert. Unique constraint wins for one, the other gets a constraint error. Catch `error.code === "23505"` and treat as success (already following).
2. **Follow → unfollow → follow:** The unique constraint means the second POST re-activates the existing row (as currently coded). The `is_active=true` update is fine. No double-row risk.
3. **Delete while concurrent POST:** Unlikely at MVP scale. At scale, you'd need a transaction or pessimistic lock on `(follower_id, leader_id)`. Not worth it now.

## Open Questions

- Should the response body include the follow state after the request (e.g., `{ following: true }`)? Useful for frontend sync but out of scope for the security fix.
- Is there a need to block following a user who has `is_banned` or `is_deleted` flag on their profile? Probably — add a profile status check alongside the existence check.
- Should there be a rate limit per caller (e.g., max 10 follows per minute)? Low priority at MVP scale but defensible.
- Should the `copy_ratio` and `max_position_size` defaults (0.5, 500) be configurable at request time or are they always the same? Currently hardcoded. If users can't set them, the defaults should be documented in the API response.
