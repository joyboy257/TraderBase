---
title: "feat: Brokerage Deactivation User Notification"
type: feat
status: active
date: 2026-03-27
origin: docs/ideation/2026-03-27-open-ideation.md
deepened: 2026-03-27
---

# feat: Brokerage Deactivation User Notification

## Overview

Fix the silent failure in `handleItemError()`: when a brokerage connection is deactivated, the user gets zero feedback. Insert a notification row and broadcast via Supabase Realtime so users know their connection broke and they need to re-authenticate.

## Problem Frame

`handleItemError()` at `plaid.ts:86-121` currently deactivates the brokerage connection and logs — the user only discovers it when copy trading stops working. This is the only notification path needed for MVP; a full notification platform is out of scope.

## Requirements Trace

- R1. User receives an in-app notification immediately after their brokerage is deactivated
- R2. Notification explains the connection was lost and links to settings to re-authenticate
- R3. `useNotifications` hook subscribes to the user's realtime notification channel

## Scope Boundaries

- Does NOT add email (Resend) — Supabase Realtime only for MVP
- Does NOT build a generic notification platform — only the brokerage deactivation path
- Does NOT add notification read/unread state management (notification exists, user can see it)

## Key Technical Decisions

- **Notifications table:** `user_id, type, title, body, read, created_at`. `type` is a string discriminator (e.g., `"brokerage_deactivated"`) — no enum needed for MVP.
- **Realtime:** Supabase channel per user: `notifications:{user_id}`. Broadcast on INSERT.
- **No email:** Resend integration is deferred — Supabase Realtime is sufficient for MVP

## Open Questions

### Resolved During Planning

- **Q: What does the notification say?** A: Title: "Brokerage connection lost". Body: "Your [BROKERAGE_NAME] connection was disconnected. Copy trading is paused until you reconnect in Settings."
- **Q: How to get brokerage name?** A: `brokerage_connections` may have `brokerage_name` column — if not, use "your brokerage" as fallback.

### Deferred to Implementation

- How to wire the notification bell component into the app layout (out of scope — hook + component are built, wiring is a separate task)

## Implementation Units

- [ ] **Unit 1: Create `notifications` table**

**Goal:** Persist notification rows so they survive across sessions

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/20260327_add_notifications_table.sql`

**Approach:**
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,          -- e.g., 'brokerage_deactivated'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT WITH CHECK (true);

-- Index for unread count query
CREATE INDEX idx_notifications_user_unread
  ON notifications(user_id, read) WHERE read = false;
```

**Patterns to follow:**
- Existing migration patterns in `supabase/migrations/YYYYMMDD_*.sql`
- `brokerage_connections` table as reference for RLS policy structure

**Test scenarios:**
- `SELECT` returns only the authenticated user's notifications
- `INSERT` by service role succeeds

**Verification:**
- Migration applies cleanly
- RLS policies are restrictive (users can't read each other's notifications)

- [ ] **Unit 2: Wire notification into `handleItemError`**

**Goal:** After deactivating the brokerage connection, insert a notification row

**Requirements:** R1, R2

**Dependencies:** Unit 1

**Files:**
- Modify: `src/lib/webhook/handlers/plaid.ts`

**Approach:**
After the `brokerage_connections` UPDATE at `plaid.ts:110`:
1. Fetch the `connection.user_id` and `connection.brokerage_name` (not currently fetched — add to the SELECT)
2. Insert a notification row: `{ user_id, type: 'brokerage_deactivated', title, body }`

**Note:** `handleItemError` currently does `SELECT` only `plaid_access_token_encrypted` at line 91. It needs to also SELECT `user_id` and `brokerage_name`.

**Patterns to follow:**
- `plaid.ts` existing pattern for service client usage
- Notification INSERT pattern from other services in the codebase (if any)

**Test scenarios:**
- `handleItemError(itemId)` with valid connection → notification row inserted with correct user_id
- `handleItemError(itemId)` with no connection → early return before notification (existing behavior)

**Verification:**
- After calling `handleItemError`, a notification row exists in the DB with `user_id = connection.user_id`

- [ ] **Unit 3: Add Supabase Realtime broadcast to notification INSERT**

**Goal:** User sees the notification in real-time without refreshing

**Requirements:** R1

**Dependencies:** Unit 2

**Files:**
- Modify: `src/lib/webhook/handlers/plaid.ts`

**Approach:**
After INSERTing the notification row, broadcast to the user's channel:
```typescript
const channel = supabase.channel(`notifications:${userId}`)
channel.send({
  type: 'broadcast',
  event: 'notification_inserted',
  payload: { notification: { id, type, title, body, created_at } }
})
```

**Patterns to follow:**
- Existing Supabase Realtime broadcast patterns in the codebase (e.g., `FeedRealtimeProvider`)
- `supabase.channel()` usage in other realtime providers

**Verification:**
- After INSERT, broadcast event is emitted on the correct user channel
- No error if Supabase Realtime is unavailable (graceful degradation — notification is still in the DB)

- [ ] **Unit 4: Create `useNotifications` hook**

**Goal:** React hook that subscribes to the user's notification realtime channel

**Requirements:** R3

**Dependencies:** None (UI-independent)

**Files:**
- Create: `src/hooks/useNotifications.ts`

**Approach:**
```typescript
// Directional guidance
export function useNotifications() {
  // Subscribe to supabase.channel(`notifications:${userId}`)
  // On 'notification_inserted' broadcast → prepend to local notification list
  // Return { notifications, unreadCount }
}
```

**Patterns to follow:**
- `useFeedRealtime.ts` as the reference pattern for realtime subscription hooks
- `useState` + `useEffect` for managing notification list

**Test scenarios:**
- Hook mounts → subscribes to correct user channel
- Broadcast received → notification list updates
- Hook unmounts → channel unsubscribes

**Verification:**
- Hook can be imported and used in a React component without TypeScript errors
- Component using the hook compiles without errors

- [ ] **Unit 5: Create `NotificationBell` UI component**

**Goal:** Minimal notification indicator for the app header

**Requirements:** R3 (UI surface for the notification)

**Dependencies:** Unit 4

**Files:**
- Create: `src/components/ui/NotificationBell.tsx`

**Approach:**
- A bell icon (from `lucide-react`) with an unread count badge
- Click opens a dropdown with recent notifications
- Uses `useNotifications()` hook
- Empty state: "No notifications"

**Patterns to follow:**
- Existing `Avatar.tsx`, `Badge.tsx` patterns in `src/components/ui/`
- Lucide icon usage throughout the codebase

**Test scenarios:**
- No notifications → bell with no badge
- 3 unread → bell with red badge showing "3"
- Click → dropdown shows notification list

**Verification:**
- Component renders without errors in a Next.js page
- Unread count badge updates in real-time when a new notification arrives

## System-Wide Impact

- **Interaction graph:** `handleItemError` is called by the Plaid webhook route. Adding INSERT + broadcast does not change the webhook response timing.
- **Error propagation:** If notification INSERT fails, log the error but don't fail the webhook response (the deactivation already happened)
- **State lifecycle risks:** Notification rows persist forever unless deleted. `read = true` toggle can be added in a follow-up.

## Risks & Dependencies

- **Risk:** If Supabase Realtime is down, the INSERT succeeds but the broadcast fails silently. User sees the notification on next page load. This is acceptable degradation.
- **Dependency:** Unit 3 (broadcast) depends on Unit 2 (INSERT). Unit 4 and 5 are independent of each other but both depend on the `notifications` table existing.

## Documentation / Operational Notes

- The notification bell should be added to the app header in a follow-up — the hook and component are ready, the wiring is a separate task
- No change to vercel.json or Supabase configuration needed

## Sources & References

- **Ideation:** [docs/ideation/2026-03-27-open-ideation.md](docs/ideation/2026-03-27-open-ideation.md)
- Related code: `src/lib/webhook/handlers/plaid.ts`, `src/components/feed/FeedRealtimeProvider.tsx`
