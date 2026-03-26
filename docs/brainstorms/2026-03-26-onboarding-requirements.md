---
date: 2026-03-26
topic: onboarding-new-user-experience
---

# Onboarding — New User Experience

## Problem Frame

New users land on an empty dashboard after signup — zero guidance on what to do first, no sense of progress, and no path toward value. Both trader and copier users are equally important, but they need different things. The app needs to give each user a clear first session experience that gets them to their first meaningful action quickly.

## Requirements

### Onboarding Wizard Modal

- R1. First-visit modal wizard appears automatically on the first login after signup OR on first visit to `/dashboard` if onboarding is not complete.
- R2. Modal has two paths presented via a single choice screen: **"I want to share trades"** (trader) or **"I want to copy traders"** (copier).
- R3. Trader path steps: (1) Profile setup → (2) Connect brokerage → (3) Create first signal.
- R4. Copier path steps: (1) Browse traders → (2) Follow at least one trader → (3) Connect brokerage.
- R5. Each step shows: step title, a single focused action, and a skip option (with consequence shown: "you can always do this later").
- R6. Progress indicator shows current step and total steps (e.g., "Step 2 of 3").
- R7. On wizard completion, modal dismisses and user lands on dashboard. Onboarding state (`onboarding_complete: true`, `onboarding_path: 'trader' | 'copier'`) is saved to the user's profile.
- R8. If user skips all steps, onboarding is marked complete but no path is set.

### Post-Wizard Dashboard

- R9. Dashboard reads `onboarding_path` from the user's profile and surfaces a contextual "next action" card.
- R10. Trader path next action: "Create your first signal" card with CTA → signal creation flow.
- R11. Copier path next action: "Discover traders to follow" card with CTA → `/traders`.
- R12. Next-action card persists on dashboard until the corresponding action is completed, then disappears.

### Profile Setup Step

- R13. Fields shown: Display name (required), bio (optional, max 500 chars).
- R14. Pre-filled with values from signup if captured (username from magic link signup).
- R15. Validation: display name 3-30 chars, alphanumeric + underscores.
- R16. On save: calls existing `saveProfile` server action. Errors shown inline.

### Browse Traders Step (Copier Path)

- R17. Shown a curated or algorithmic selection of top traders (e.g., by followers or return).
- R18. Each trader card has a single "Follow" button — no copy action yet.
- R19. At least one follow must be completed to advance. "Next" button is disabled/grayed until a follow happens.
- R20. Follow action calls existing `POST /api/follow` endpoint.

### Connect Brokerage Step (Both Paths)

- R21. Shown for both trader and copier paths, but with different framing:
    - Trader: "Connect your brokerage to share verified positions"
    - Copier: "Connect your brokerage to enable real trade copying"
- R22. Triggers the existing `BrokerageConnector` / Plaid Link flow.
- R23. On success: step is marked complete, user advances. On Plaid error: inline error message, retry option.

### Create First Signal Step (Trader Path)

- R24. Shown after brokerage is connected.
- R25. Pre-filled ticker field focused on load (keyboard visible on mobile).
- R26. Fields: Ticker (required), Action (BUY/SELL toggle), Entry Price (optional — can use current market price), Rationale (optional).
- R27. On submit: calls `createSignal` server action. On success: step complete, wizard closes.

### Copy Barrier

- R28. If a copier (user with `onboarding_path: 'copier'`) attempts to copy a signal before a brokerage is linked, a blocking toast appears: "Connect a brokerage to copy trades" with a "Link Now" button that opens the BrokerageConnector.
- R29. Barrier only applies to copy actions — following traders remains unblocked without brokerage.

### Onboarding State Management

- R30. Onboarding state stored in `profiles` table: `onboarding_complete` (bool), `onboarding_path` (enum: 'trader' | 'copier' | null), `onboarding_step` (int).
- R31. Server action `completeOnboardingStep(step: number)` updates `onboarding_step`.
- R32. Server action `finishOnboarding(path: 'trader' | 'copier')` sets `onboarding_complete: true` and `onboarding_path`.

## Success Criteria

- New user completes wizard in under 2 minutes on mobile
- At least 80% of new signups who reach the wizard complete at least step 1 (profile or browse)
- Traders who complete onboarding create their first signal within the same session
- Copiers who complete onboarding follow at least one trader and attempt to copy within the same session
- Dashboard next-action card correctly reflects path and disappears after action is taken

## Scope Boundaries

- Feed / social features (likes, comments, posts) are out of scope for this onboarding
- Email/password auth fallback is out of scope
- Native iOS onboarding is out of scope (web only for now)
- Analytics / event tracking instrumentation is out of scope (can be added later)

## Key Decisions

- **No forced completion**: Users can skip any step. We optimize for completion but don't block access. Rationale: forcing a multi-step flow creates drop-off; a guidance-first approach builds trust.
- **Onboarding state in profiles table**: Stored on the user profile rather than localStorage/session. Rationale: works across devices, survives logout/login, can be used for email re-engagement campaigns.
- **Copy blocked before brokerage**: Copiers cannot copy until brokerage is linked. Rationale: prevents a broken experience (queued copies that never execute) and sets correct expectations from day one.

## Dependencies / Assumptions

- `BrokerageConnector` component and Plaid Link token flow already exist and are functional
- `POST /api/follow` endpoint already exists
- `saveProfile` server action already exists
- `profiles` table has or can accept `onboarding_complete`, `onboarding_path`, `onboarding_step` columns (may need migration)
- `createSignal` server action already exists

## Outstanding Questions

### Resolve Before Planning
- **[DB Migration]**: Does the `profiles` table need a migration to add `onboarding_complete`, `onboarding_path`, `onboarding_step` columns? Or are these handled differently?
- **[Signal creation]**: The `createSignal` action takes ticker, action, entry_price, stop_loss, take_profit, rationale. Does the onboarding signal creation need to handle stop_loss/take_profit, or just the basic fields (R26)?

### Deferred to Planning
- **[UX]**: What is the exact visual treatment of the modal — does it darken/frost the background? Is it truly full-screen or a centered card? (Low stakes — can be designed during build)
- **[Analytics]**: Which events should fire on wizard steps (step_view, step_complete, onboarding_complete)? (Deferred — analytics infrastructure not yet built)

## Next Steps

→ `/ce:plan` for structured implementation planning
