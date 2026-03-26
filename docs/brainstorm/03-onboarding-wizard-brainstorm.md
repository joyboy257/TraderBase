# Onboarding Wizard Brainstorm

## Root Cause

The ideation doc describes `handleBrokerageComplete` as a no-op, but the actual bug is more subtle and more severe: `ConnectBrokerageStep.handleConnected` **does** call `finishOnboarding(path)` and `completeOnboardingStep(2)`, but **ignores the return value entirely**. If either server action fails, `onboarding_complete` stays `false` in the DB, but `onComplete()` is called unconditionally, dismissing the wizard. The user appears to have completed onboarding but the profile is left incomplete.

The no-op `handleBrokerageComplete` in `OnboardingWizard.tsx` is the second half of the bug: even if `finishOnboarding` succeeds server-side, the wizard's `handleBrokerageComplete` does nothing -- no navigation, no state reset. Combined with `skipReload={true}` (which suppresses the only mechanism that would force a fresh profile fetch), the wizard's internal state never syncs with the server state after a successful connection.

```
BrokerageConnector.onSuccess → handleConnected() [ConnectBrokerageStep]
  → completeOnboardingStep(2)   ← fires, return value unchecked
  → finishOnboarding(path)      ← fires, return value unchecked
  → onComplete()               ← always called, even on DB failure
    → handleBrokerageComplete() [OnboardingWizard] ← no-op, wizard lingers
```

## Correct Flow

**Trader path:** `path → profile → (brokerage | skip) → [done]`
**Copier path:** `path → profile → browse → (brokerage | skip) → [done]`

Both paths should call `finishOnboarding(path)` exactly once, at the terminal step (brokerage connected OR skip). The wizard should dismiss itself only after confirming the DB write succeeded.

## Edge Cases

### Plaid Link closed without connecting
`onConnected` never fires. `handleBrokerageComplete` is never called. The wizard stays on the brokerage step. The `skipReload={true}` prop means no reload happens. The user is stuck and must refresh the page to escape. The `onSkip` handler in `OnboardingWizard` is also a no-op, so "Skip for now" also does nothing. This is a hard dead end.

### Already has brokerage connected
The brokerage step is still shown. Clicking "Link Brokerage" opens Plaid Link again (the `BrokerageConnector` has no check for existing connection). If Plaid returns the same institution, the token exchange API may or may not be idempotent. No idempotency key is sent to `/api/plaid/exchange-token`.

### Trader skips brokerage
`onSkip` is passed to `ConnectBrokerageStep` but `handleSkip` in `OnboardingWizard` is empty. `finishOnboarding` is never called. The user is stuck on the brokerage step with no way out. If they refresh, the wizard reappears at the same step because `onboarding_complete` is still `false`.

### `finishOnboarding` DB failure
`onConnected()` does not check the return value of `finishOnboarding(path)`. If the Supabase update fails (network, RLS, constraint violation), `onboarding_complete` remains `false` but `onComplete()` is still called, dismissing the wizard. The user sees no error.

### `skipReload={true}` + `revalidatePath`
`skipReload={true}` prevents `window.location.reload()`. `finishOnboarding` calls `revalidatePath("/dashboard")`, but the wizard is a portal rendered directly on top of the page -- it does not live on the dashboard route, so revalidating that path has no effect on the wizard's own state. The wizard's `currentStep` is entirely client-side and never re-reads the profile after the initial mount.

### Race: user closes tab during `onConnected`
`onConnected` is async. If the user closes the tab after `finishOnboarding` starts but before `onComplete()` is called, the DB may be updated but the wizard state is lost. On next visit, the profile shows `onboarding_complete: true` (good), but if the user was mid-flow on a copier path, they have no followed traders.

### Plaid token exchange not idempotent
`/api/plaid/exchange-token` receives `public_token` and `metadata` but no idempotency key. If the fetch retries (e.g. a brief network glitch), the same token could be exchanged twice, creating duplicate brokerage connection rows.

## Open Questions

1. **What should "Skip" do for the brokerage step?** Should it call `finishOnboarding` and let the user link later? Or should it skip the brokerage step entirely and move to the next (for traders, create_signal; for copiers, done)?

2. **Should `skipReload={true}` be `false` for the onboarding flow?** A full page reload after brokerage connection would force a fresh profile fetch, likely resolving the wizard-state sync issue without any explicit navigation. But this may cause a flash or feel disruptive.

3. **Does `CreateSignalStep` (trader path) call `finishOnboarding`?** No code was found for `CreateSignalStep`, but the comment in `handleCreateSignalComplete` says `finishOnboarding('copier')` is called inside it -- which looks copy-pasted from the wrong path. For the trader path, `CreateSignalStep` should call `finishOnboarding('trader')`, not `finishOnboarding('copier')`.

4. **Should `BrokerageConnector` check for an existing brokerage connection before opening Plaid Link?** If the user already linked, the button should say "Relink" or navigate to account settings rather than re-open Plaid Link for the same account.

5. **Should `onConnected` await `finishOnboarding` before calling `onComplete()`?** Currently `completeOnboardingStep` is awaited, then `finishOnboarding` is awaited, then `onComplete()` is called synchronously. If `onComplete()` triggers navigation, the pending `finishOnboarding` promise may be abandoned by Next.js server action handling.
