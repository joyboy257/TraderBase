---
title: "feat: Onboarding wizard for new users"
type: feat
status: completed
date: 2026-03-26
origin: docs/brainstorms/2026-03-26-onboarding-requirements.md
deepened: 2026-03-26
---

# Onboarding Wizard for New Users

## Overview

Add a first-visit modal wizard that guides new users down either a **trader path** (profile → brokerage → create signal) or **copier path** (browse traders → follow → connect brokerage). After completion, the dashboard shows a contextual next-action card based on which path was chosen.

## Problem Frame

New users land on an empty dashboard after signup with zero guidance. Both trader and copier paths need to reach their first meaningful action (create signal / follow + copy) within the same session.

## Requirements Trace

- R1, R2, R3, R4, R5, R6, R7, R8 → Onboarding modal with two paths and step navigation
- R9, R10, R11, R12 → Post-wizard dashboard next-action card
- R13, R14, R15, R16 → Profile setup step (extends existing `saveProfile`)
- R17, R18, R19, R20 → Browse traders step with follow gating
- R21, R22, R23 → Connect brokerage step (wraps existing `BrokerageConnector`)
- R24, R25, R26, R27 → Create first signal step (new server action)
- R28, R29 → Copy barrier on `CopySignalButton` (server-enforced + UI surface)
- R30, R31, R32 → Onboarding state management

## Scope Boundaries

- Feed/social features, email/password auth, iOS onboarding, analytics instrumentation — all out of scope
- Signal editing or deletion — out of scope

## Success Criteria

These are derived from the origin document's success criteria, updated to match this plan's implementation:

- **Traders who complete onboarding** link their brokerage within the same session. Signal creation is encouraged in the wizard (CreateSignalStep) but is **not required** for onboarding completion — `finishOnboarding('trader')` fires in `ConnectBrokerageStep.onConnected`. This is the authoritative completion gate for the trader path.
- **Copiers who complete onboarding** follow at least one trader and connect a brokerage within the same session. Copying trades (R29) is gated behind brokerage connection — copiers cannot copy until after onboarding is complete and a brokerage is linked. "Attempt to copy" in the origin document is a post-onboarding action, not an onboarding completion requirement.

## Context & Research

### Relevant Code and Patterns

| Purpose | Path |
|---------|------|
| Brokerage connection component | `src/components/plaid/BrokerageConnector.tsx` |
| Settings page (uses BrokerageConnector) | `src/app/(app)/settings/page.tsx` |
| Follow API | `src/app/api/follow/route.ts` |
| Profile save server action | `src/app/actions/settings.ts` |
| Dashboard page | `src/app/(app)/dashboard/page.tsx` |
| Signals page | `src/app/(app)/signals/page.tsx` |
| CopySignalButton | `src/components/social/CopySignalButton.tsx` |
| Copy trading server action | `src/app/actions/copy-trading.ts` |
| Existing UI components | `src/components/ui/` |

**Signal shape**: `ticker, action, entry_price, current_price, stop_loss, take_profit, rationale, is_active, created_at` with `profiles: { username, display_name, avatar_url, is_verified }`

**BrokerageConnector key detail**: `onConnected?: () => void` callback fires synchronously before `window.location.reload()`. The reload fires immediately without awaiting `onConnected`.

**Onboarding state in `profiles` confirmed correct**: All profile state is in `profiles` table. `user_metadata` is unused in the codebase. Adding columns to `profiles` is consistent with existing `saveProfile`, `saveCopySettings` patterns.

### Key Findings from Deepening

**Critical bug found**: `ConnectBrokerageStep`'s `onConnected` only calls `completeOnboardingStep`. For the trader path, `finishOnboarding('trader')` is never called — `onboarding_complete` stays `false` forever. Traders get an infinite wizard loop after linking brokerage.

**Race condition found**: `window.location.reload()` fires immediately in `BrokerageConnector.onSuccess` without awaiting the async `completeOnboardingStep` call. The page reloads before the DB write commits. On next load, `onboarding_complete` is still `false` — the wizard reappears.

**Copy barrier enforcement**: Must be server-side in `triggerCopyTrade` (authoritative, cannot be bypassed). Client-side check in `CopySignalButton` is a UX optimization only.

## Key Technical Decisions

- **`<OnboardingCheck>` client component pattern** (not full dashboard client conversion): Keep `page.tsx` as a server component. Extract only the wizard/banner conditional into a thin `<OnboardingCheck profile={profile}>` client component. Preserves RSC benefits, minimal client boundary, no hydration risk.

- **`BrokerageConnector` fork with `skipReload` prop**: Add `skipReload?: boolean` prop. When `true`, skips `window.location.reload()` after `onConnected` fires. Used by `ConnectBrokerageStep` to avoid the race condition.

- **`finishOnboarding('trader')` called in `ConnectBrokerageStep.onConnected`**: Trader onboarding is complete when brokerage is linked (they may never create a signal). Calling `finishOnboarding` here fixes the infinite loop bug.

- **Copy barrier: server action primary, UI secondary**: `triggerCopyTrade` independently checks `onboarding_path` and brokerage connection before any execution. Returns typed `{ success: false, error: "NO_BROKERAGE" }`. `CopySignalButton` shows blocking toast on this error.

- **Onboarding state in `profiles` table**: Confirmed correct — consistent with existing patterns, RLS-protected, no new fetching mechanism needed.

## Open Questions

### Resolved During Planning

- **DB Migration**: Yes — add `onboarding_complete BOOL DEFAULT FALSE`, `onboarding_path TEXT CHECK`, `onboarding_step INT DEFAULT 0` to `profiles`.
- **Signal fields**: ticker, action, entry_price (optional, falls back to current market price per R26), stop_loss, take_profit, rationale.
- **Modal treatment**: Full-screen overlay with centered card, frosted backdrop, step indicator, skip link per step.
- **Trader path completion**: `ConnectBrokerageStep.onConnected` calls `finishOnboarding('trader')` — no separate create-signal requirement for trader onboarding completion.
- **`BrokerageConnector` fork**: Add `skipReload?: boolean` prop. `ConnectBrokerageStep` passes `skipReload={true}`. Settings page continues using the default (reload behavior unchanged).
- **`triggerCopyTrade` canCopy check**: Mandatory server-side enforcement. Returns `error: "NO_BROKERAGE"` when user is a copier with no active brokerage connection.

### Deferred to Implementation

- Exact CSS animation classes — follow existing Tailwind patterns
- Banner copy text — use placeholder from requirements doc

## Implementation Units

- [ ] **Unit 1: Supabase migration — add onboarding columns to profiles**

**Goal:** Add `onboarding_complete`, `onboarding_path`, `onboarding_step` columns to `profiles`.

**Requirements:** R30, R31, R32

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/20260326_add_onboarding_columns.sql`

**Approach:**
- Add columns with defaults: `onboarding_complete BOOL DEFAULT FALSE`, `onboarding_path TEXT CHECK (value IN ('trader','copier'))`, `onboarding_step INT DEFAULT 0`
- Defaults ensure existing rows are unaffected; new users start with onboarding incomplete

**Verification:**
- `SELECT onboarding_complete, onboarding_path, onboarding_step FROM profiles LIMIT 1` returns new columns
- Existing profiles retain data; new signups see `onboarding_complete = false`

---

- [ ] **Unit 2: Server actions — onboarding state + createSignal + canCopy guard**

**Goal:** Add `finishOnboarding`, `completeOnboardingStep`, `createSignal`. Enforce copy barrier in `triggerCopyTrade`.

**Requirements:** R31, R32, R27, R28

**Dependencies:** Unit 1 (migration)

**Files:**
- Create: `src/app/actions/onboarding.ts`
- Create: `src/app/actions/signals.ts`
- Modify: `src/app/actions/copy-trading.ts`
- Test: `src/app/actions/__tests__/onboarding.test.ts`
- Test: `src/app/actions/__tests__/signals.test.ts`

**Approach:**

`finishOnboarding(path: 'trader' | 'copier')`:
```typescript
// Auth check → update profiles: onboarding_complete = true, onboarding_path = path
// revalidatePath("/dashboard")
// Returns { success: true } | { error: string }
```

`completeOnboardingStep(step: number)`:
```typescript
// Auth check → update profiles: onboarding_step = step
// Returns { success: true } | { error: string }
```

`createSignal(formData: FormData)`:
```typescript
// Auth check → validate ticker (required, uppercase), action ('BUY'|'SELL')
// entry_price (optional, positive if provided — uses current market price as fallback per R26)
// Optional: stop_loss, take_profit (positive if provided), rationale (max 1000 chars)
// Inserts signals with is_active: true, is_verified: false
// revalidatePath("/signals"), revalidatePath("/dashboard")
// Returns { success: true, signal_id: string } | { error: string }
```

**`triggerCopyTrade` — add canCopy guard (REQUIRED, not optional):**
```typescript
// After auth check, before any execution:
// 1. Fetch profile: onboarding_path, onboarding_complete
// 2. If onboarding_complete && onboarding_path === 'copier':
//      Fetch active brokerage_connections for user
//      If none: return { success: false, error: "NO_BROKERAGE" }
// 3. Proceed with existing copy logic
```
This is the authoritative server-side enforcement. The UI barrier in `CopySignalButton` is a UX enhancement only — it cannot be relied upon for security.

**Test scenarios:**
- `createSignal`: rejects unauthenticated, rejects missing ticker, rejects invalid action, accepts valid signal
- `finishOnboarding`: rejects invalid path, atomically sets both fields
- `triggerCopyTrade` with copier + no brokerage: returns `{ success: false, error: "NO_BROKERAGE" }`
- `triggerCopyTrade` with trader or copier-with-brokerage: proceeds normally

**Verification:**
- `triggerCopyTrade` returns `NO_BROKERAGE` for the correct condition and only that condition
- `createSignal` inserts a retrievable row; all three actions return correct error shapes

---

- [ ] **Unit 3: BrokerageConnector — add skipReload prop**

**Goal:** Allow `BrokerageConnector` to skip `window.location.reload()` so onboarding can handle the post-connection transition without a race condition.

**Requirements:** R21, R22, R23

**Dependencies:** Unit 2 (onboarding actions)

**Files:**
- Modify: `src/components/plaid/BrokerageConnector.tsx`

**Approach:**
```typescript
interface BrokerageConnectorProps {
  onConnected?: () => void;
  skipReload?: boolean; // new
}

// In onSuccess callback:
onConnected?.();
if (!skipReload) {
  window.location.reload();
}
```

**Patterns to follow:** Minimal change — only add the prop and the conditional. No other behavior changes.

**Verification:**
- Settings page (no `skipReload` prop) continues to reload after connection
- Onboarding step (with `skipReload={true}`) does not reload — `onConnected` fires and wizard handles state transition

---

- [ ] **Unit 4: OnboardingWizard client component + step components**

**Goal:** Build the modal UI and all step sub-components.

**Requirements:** R1–R8, R13–R27 (except R28 — enforced in Unit 2)

**Dependencies:** Unit 2 (actions exist), Unit 3 (BrokerageConnector skipReload)

**Files:**
- Create: `src/components/onboarding/OnboardingWizard.tsx`
- Create: `src/components/onboarding/steps/PathChoiceStep.tsx`
- Create: `src/components/onboarding/steps/ProfileSetupStep.tsx`
- Create: `src/components/onboarding/steps/BrowseTradersStep.tsx`
- Create: `src/components/onboarding/steps/ConnectBrokerageStep.tsx`
- Create: `src/components/onboarding/steps/CreateSignalStep.tsx`
- Create: `src/components/onboarding/OnboardingBanner.tsx`
- Test: `src/components/onboarding/__tests__/OnboardingWizard.test.tsx`

**Approach:**

`OnboardingWizard` — client component:
1. Receives `profile` as prop (server-fetched in parent)
2. If `profile.onboarding_complete === true` → renders nothing
3. Reads `profile.onboarding_path` and `profile.onboarding_step` to determine which step to render
4. `ConnectBrokerageStep` passes `skipReload={true}` to `BrokerageConnector`
5. `ConnectBrokerageStep.onConnected` → calls `completeOnboardingStep(n+1)` for both paths; for trader path, also calls `finishOnboarding('trader')`
6. Uses `createPortal` to render into `document.body` above all page content

**Step components:**

`PathChoiceStep`: Two cards — "Share my trades" and "Copy other traders". Clicking one calls `finishOnboarding` with path, then advances to step 1.

`ProfileSetupStep`: Controlled form (display_name pre-filled from `profile`, bio). Calls `saveProfile`. On success: `completeOnboardingStep(1)`.

`BrowseTradersStep`: Fetches top traders on mount (calls `getTopTraders`). **Loading state**: show 3–4 skeleton card placeholders matching the card dimensions. **Empty state**: if no traders returned, show "No traders found" with a skip option. **Trader cards** display: avatar, display_name/@username, follower count, win rate or recent return % (whatever `getTopTraders` returns — see Unit 7 spec). Follow button per card calls `POST /api/follow`. "Next" disabled until ≥1 follow. On advance: `completeOnboardingStep(1)`.

`ConnectBrokerageStep`: Renders `BrokerageConnector` with `skipReload={true}`. `onConnected`: **await** `completeOnboardingStep(2)`, then **await** `finishOnboarding('trader')` for the trader path. Copier path ends here — `finishOnboarding('copier')` is called here as well. Wizard dismisses for both paths after this step completes. Framed differently per path.

> **Note:** The plan currently shows copiers advancing to `CreateSignalStep` after `ConnectBrokerageStep`, with `finishOnboarding('copier')` firing on signal creation. However, R4 defines the copier path as ending at brokerage connection (no signal creation requirement for onboarding completion). This is a **plan contradiction** — the OnboardingWizard flow (both paths → CreateSignalStep) conflicts with R4 (copier path = browse → follow → connect brokerage). Resolution: copiers should call `finishOnboarding('copier')` in `ConnectBrokerageStep.onConnected` and the wizard should dismiss there. CreateSignalStep should remain trader-only.

`CreateSignalStep` **(trader path only)**: Ticker input (uppercase, auto-focused), BUY/SELL toggle, entry price, stop loss, take profit, rationale textarea. On submit: `createSignal`. On success: wizard dismisses — `finishOnboarding('trader')` was already called in `ConnectBrokerageStep`, so this step is optional for traders (they may skip signal creation and still complete onboarding). Copiers do not reach this step.

`OnboardingBanner`: Receives `profile`, `signals[]`, `followedLeaders[]` as props. Computes:
```typescript
const traderActionTaken = signals?.some(s => s.user_id === profile.id);
const copierActionTaken = followedLeaders?.length > 0;
const showBanner = profile.onboarding_complete &&
  ((profile.onboarding_path === 'trader' && !traderActionTaken) ||
   (profile.onboarding_path === 'copier' && !copierActionTaken));
```
Trader banner: "Create your first signal" + CTA to `/signals`. Copier banner: "Discover traders to follow" + CTA to `/traders`.

**Execution note:** Implement step components first, then wizard shell last.

**Test scenarios:**
- Wizard invisible when `onboarding_complete === true`
- Trader path: after ConnectBrokerageStep completes → `completeOnboardingStep(2)` awaited, then `finishOnboarding('trader')` awaited → wizard dismisses. Trader may optionally create a signal in CreateSignalStep before dismissing.
- Copier path: after ConnectBrokerageStep completes → `completeOnboardingStep(2)` awaited, then `finishOnboarding('copier')` awaited → wizard dismisses (signal creation is post-onboarding, not a required step for copier onboarding completion per R4)
- Banner suppresses correctly after action taken

**Verification:**
- Wizard re-appears on refresh until `onboarding_complete === true`
- Trader completes wizard after brokerage link (no signal required for onboarding completion)
- Copier completes wizard after brokerage link (signal creation is post-onboarding, not required for completion per R4)
- Banner disappears after target action

---

- [ ] **Unit 5: Dashboard — integrate wizard and banner via `<OnboardingCheck>`**

**Goal:** Keep dashboard as server component; inject wizard and banner via a thin client component.

**Requirements:** R1, R9, R10, R11, R12

**Dependencies:** Unit 4 (wizard + banner exist)

**Files:**
- Create: `src/components/onboarding/OnboardingCheck.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/components/onboarding/OnboardingBanner.tsx` (update to accept signals + follows as props)

**Approach:**

Keep `page.tsx` as a server component. It already fetches `profile`, `positions`, `signals`, `followedLeaders`. Add `onboarding_complete`, `onboarding_path`, `onboarding_step` to the profile select, and `signals` filtered by `user_id = currentUser` and `followedLeaders` to the existing queries.

Pass these as props to `<OnboardingCheck>`:
```tsx
<OnboardingCheck
  profile={profile}
  userSignals={userSignals}
  followedLeaders={followedLeadersResult.data}
/>
```

`<OnboardingCheck>` is a thin client component that:
1. Conditionally renders `<OnboardingWizard profile={profile}>` if `!profile.onboarding_complete`
2. Conditionally renders `<OnboardingBanner profile={profile} signals={userSignals} follows={followedLeaders} />` if `profile.onboarding_complete`

**Patterns to follow:**
- `ProfileForm` receives `profile` as a prop from server-rendered `settings/page.tsx` — same pattern
- Server component fetches; client component only handles conditional rendering

**Verification:**
- New user sees wizard on first `/dashboard` visit
- After wizard completion, wizard is gone and banner appears
- After target action (signal or follow), banner disappears

---

- [ ] **Unit 6: Copy barrier — update CopySignalButton to handle NO_BROKERAGE**

**Goal:** Update `CopySignalButton` to surface `NO_BROKERAGE` error from `triggerCopyTrade` as a blocking toast with "Link Now" CTA.

**Requirements:** R28, R29

**Dependencies:** Unit 2 (`triggerCopyTrade` has canCopy guard)

**Files:**
- Modify: `src/components/social/CopySignalButton.tsx`
- Test: `src/components/social/__tests__/CopySignalButton.test.tsx`

**Approach:**

Current `CopySignalButton` calls `triggerCopyTrade` and handles `{ success, error }`. Extend to:
```typescript
// After triggerCopyTrade returns:
if (result.error === "NO_BROKERAGE") {
  // Show blocking toast: "Connect a brokerage to copy trades"
  // Toast has "Link Now" button → opens BrokerageConnector
  return;
}
// Otherwise show existing error/success handling
```

The "Link Now" button should open the `BrokerageConnector` — since it's a standalone component, this could be rendered in a small modal or the button could link to `/settings#brokerage`.

**Patterns to follow:**
- `BrokerageConnector` error display pattern in `settings/page.tsx` — same inline error + retry pattern, adapted as a blocking overlay
- Existing `CopySignalButton` loading/error state

**Test scenarios:**
- Trader clicks Copy: works normally
- Copier with brokerage clicks Copy: works normally
- Copier without brokerage clicks Copy: sees blocking toast with "Link Now"
- After linking brokerage, copier can copy

**Verification:**
- Copier without brokerage cannot trigger copy — sees toast
- Trader always can
- Copier with brokerage always can

---

- [ ] **Unit 7: getTopTraders utility for BrowseTradersStep**

**Goal:** Provide curated top trader data for the onboarding Browse Traders step and improve the `/traders` page.

**Requirements:** R17, R18, R19

**Dependencies:** Unit 4 (step component exists)

**Files:**
- Create: `src/lib/traders.ts` — `getTopTraders(limit: number)` function
- Modify: `src/app/(app)/traders/page.tsx` — use `getTopTraders` for consistent ordering
- Test: `src/lib/__tests__/traders.test.ts`

**Approach:**

`getTopTraders` is a server-side utility querying `profiles` where `is_trader = true`, ordered by `followers_count DESC`, limited to N. Returns `{ id, username, display_name, avatar_url, followers_count }`. Called from `BrowseTradersStep` on mount. Unit 7 must define which performance field (win_rate, recent_return_pct, etc.) to include — coordinate with BrowseTradersStep card spec before implementation.

**Verification:**
- Step shows real trader data
- Empty state handled gracefully

---

## System-Wide Impact

- **BrokerageConnector**: New `skipReload` prop — settings usage unchanged, onboarding uses `skipReload={true}`. No breaking change.
- **Dashboard**: Server component stays server-side. `OnboardingCheck` client component is the only new client boundary.
- **`triggerCopyTrade`**: New authorization check — returns `NO_BROKERAGE` for copiers without brokerage. Existing callers (if any) unaffected since they receive typed error.
- **`/traders` page**: Benefits from `getTopTraders` utility for improved ordering.
- **Revalidation**: `createSignal`, `finishOnboarding`, `completeOnboardingStep` all call `revalidatePath` — dashboard and signals refresh after actions.

## Risks & Dependencies

- **Unit 3 before Unit 4**: `ConnectBrokerageStep` needs `skipReload` before it can be implemented correctly — Unit 3 must land before Unit 4's `ConnectBrokerageStep`.
- **Unit 2 before Unit 5**: `OnboardingCheck` reads `onboarding_complete` from profile — the column must exist (Unit 1) and the profile select in `page.tsx` must include these fields (Unit 5 adds them to the select, not Unit 2).
- **Race condition on reload**: `skipReload={true}` in `ConnectBrokerageStep` prevents the immediate reload. `finishOnboarding` and `completeOnboardingStep` are called inside the `onConnected` callback — must be awaited within the callback (not fire-and-forget) so the DB write commits before the wizard state advances.
- **Multi-tab consistency**: `revalidatePath("/dashboard")` in `finishOnboarding` handles cache invalidation. Users who complete wizard in Tab A will see correct state in Tab B on next request.

## Documentation / Operational Notes

- Run `supabase/migrations/20260326_add_onboarding_columns.sql` in the SQL editor before deploying
- `OnboardingBanner` copy text: use placeholder from requirements doc (R10, R11) — no blocking decision needed
