# Implementation Plan: Follow API Security Fix

## Overview

The follow API (`/api/follow/route.ts`) has three security/correctness defects:

1. **POST handler (line 4-35):** Accepts any `leader_id` UUID without verifying the leader exists in `profiles`. Any authenticated user can create garbage follow rows for non-existent users.
2. **DELETE handler (line 37-52):** Has no self-follow guard, no leader existence check, silently succeeds even when passed a non-existent UUID.
3. **Both handlers:** Do not handle PostgreSQL constraint violation error code `23505` (unique constraint violation), which can occur under concurrent follow requests.

---

## Reference: Source File Analysis

**File:** `/home/claude/TraderBase/src/app/api/follow/route.ts`

**Current POST handler (lines 4-35):**
- Line 7: Auth check - returns 401 if no user
- Line 10: `leader_id` presence check - returns 400 if missing
- Line 11: Self-follow check - returns 400 if `leader_id === user.id`
- **MISSING:** Leader existence check (should query `profiles` table)
- **MISSING:** Constraint violation handling (error code 23505)

**Current DELETE handler (lines 37-52):**
- Line 40: Auth check - returns 401 if no user
- Line 43: `leader_id` presence check - returns 400 if missing
- **MISSING:** Self-follow guard
- **MISSING:** Leader existence check
- Lines 45-49: Sets `is_active: false` - silently succeeds even when no row matches

---

## Required Changes

### Change 1: Add UUID Validation to Both Handlers

After line 10 (POST) and line 43 (DELETE), add:

```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (!UUID_REGEX.test(leader_id)) {
  return NextResponse.json({ error: "Invalid leader_id format" }, { status: 400 });
}
```

### Change 2: Add Leader Existence Check to POST Handler

Add between line 11 (self-follow check) and line 13 (existing-follows check):

```typescript
const { data: leaderProfile } = await supabase
  .from("profiles")
  .select("id")
  .eq("id", leader_id)
  .single();

if (!leaderProfile) {
  return NextResponse.json({ error: "User not found" }, { status: 404 });
}
```

### Change 3: Add Self-Follow Guard and Leader Existence Check to DELETE Handler

Add between line 43 (presence check) and line 45 (update call):

```typescript
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

### Change 4: Handle Constraint Violation on POST Insert

Wrap the insert block (lines 25-31) with try/catch to handle race condition (two concurrent POST requests both try to insert):

```typescript
} else {
  const { error: insertError } = await supabase.from("follows").insert({
    follower_id: user.id,
    leader_id: leader_id,
    copy_ratio: 0.5,
    max_position_size: 500,
    is_active: true,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      // Already following - reactivate if needed (best effort, ignore error)
      await supabase
        .from("follows")
        .update({ is_active: true })
        .eq("follower_id", user.id)
        .eq("leader_id", leader_id);
    } else {
      console.error("Follow insert error:", insertError);
      return NextResponse.json({ error: "Failed to follow" }, { status: 500 });
    }
  }
}
```

### Change 5: DELETE Idempotency Behavior

DELETE should return 200 even if no row exists (idempotent). The leader existence check returns 404 for non-existent leaders (client bug worth surfacing). The existing `update().eq(...).eq(...)` with `is_active: false` already succeeds silently when no rows match — keep this behavior.

---

## Error Response Summary

| Scenario | HTTP Status | Response Body |
|----------|-------------|----------------|
| No auth session | 401 | `{ error: "Unauthorized" }` |
| Missing `leader_id` | 400 | `{ error: "leader_id required" }` |
| Invalid UUID format | 400 | `{ error: "Invalid leader_id format" }` |
| Self-follow (POST) | 400 | `{ error: "Cannot follow yourself" }` |
| Self-follow (DELETE) | 400 | `{ error: "Invalid operation" }` |
| Leader not found | 404 | `{ error: "User not found" }` |
| DB error (non-constraint) | 500 | `{ error: "Failed to follow" }` |

---

## Files Requiring Changes

1. `/home/claude/TraderBase/src/app/api/follow/route.ts` — All changes

No database migration needed.

---

## Verification Checklist

**POST /api/follow:**
- [ ] Valid leader_id of real user -> 200, follow created
- [ ] leader_id of self -> 400, `{ error: "Cannot follow yourself" }`
- [ ] Non-existent UUID -> 404, `{ error: "User not found" }`
- [ ] Malformed UUID -> 400, `{ error: "Invalid leader_id format" }`
- [ ] Without auth -> 401
- [ ] Twice for same leader (re-activate) -> 200 on both

**DELETE /api/follow:**
- [ ] Valid leader_id of real user you follow -> 200, follow deactivated
- [ ] leader_id of self -> 400, `{ error: "Invalid operation" }`
- [ ] Non-existent UUID -> 404, `{ error: "User not found" }`
- [ ] User you are NOT following -> 200 (idempotent)
- [ ] Twice for same leader -> 200 on both (idempotent)

**Race Condition:**
- [ ] Two concurrent POST for same leader -> only one row created, both return 200
