# Implementation Plan: Onboarding Wizard Fixes

## Summary of Bugs

| # | Bug | Location | Severity |
|---|-----|----------|----------|
| 1 | `handleConnected` ignores `finishOnboarding` result; wizard dismisses even when DB write fails | `ConnectBrokerageStep.tsx` lines 18-26 | P0 |
| 2 | `handleBrokerageComplete` is a no-op; wizard never dismisses after brokerage connects | `OnboardingWizard.tsx` lines 64-71 | P0 |
| 3 | `handleSkip` is a no-op; "Skip for now" buttons are dead ends | `OnboardingWizard.tsx` lines 77-80 | P0 |
| 4 | `finishOnboarding('copier')` comment in trader-path handler is a copy-paste error | `OnboardingWizard.tsx` line 74 | P1 |

---

## Current Code Flow (Traders)

```
PathChoiceStep.selectPath("trader")
  → finishOnboarding("trader")
  → onPathChosen("trader")

OnboardingWizard: path="trader", step=0
  → setCurrentStep("profile")

ProfileSetupStep.handleSubmit
  → completeOnboardingStep(1)
  → onComplete() → setCurrentStep("brokerage")

ConnectBrokerageStep.handleConnected
  → await completeOnboardingStep(2)   ← return value UNCHECKED
  → await finishOnboarding("trader") ← return value UNCHECKED
  → onComplete()                      ← ALWAYS called, even if above failed
    → handleBrokerageComplete()       ← NO-OP: wizard never dismisses
```

**The wizard is stuck at the brokerage step for traders even when brokerage connects successfully.**

---

## File-by-File Changes

### 1. `/home/claude/TraderBase/src/components/onboarding/steps/ConnectBrokerageStep.tsx`

**Bug 1: `handleConnected` ignores `finishOnboarding` return value**

Lines 18-26 currently:
```typescript
async function handleConnected() {
  startTransition(async () => {
    await completeOnboardingStep(2);
    await finishOnboarding(path);
    onComplete();
  });
}
```

Fix: check `finishOnboarding` result. Only call `onComplete()` if it succeeds. If it fails, show an inline error.

```typescript
async function handleConnected() {
  const [stepError, setStepError] = useState<string | null>(null);
  startTransition(async () => {
    const stepResult = await completeOnboardingStep(2);
    if (!stepResult.success) {
      setStepError("Failed to save step progress. Please try again.");
      return;
    }
    const finishResult = await finishOnboarding(path);
    if (!finishResult.success) {
      setStepError(finishResult.error ?? "Failed to complete onboarding. Please try again.");
      return;
    }
    onComplete();
  });
}
```

Display `stepError` in the JSX after the BrokerageConnector.

---

### 2. `/home/claude/TraderBase/src/components/onboarding/OnboardingWizard.tsx`

**Bug 2: `handleBrokerageComplete` is a no-op**

Lines 64-71 currently:
```typescript
function handleBrokerageComplete() {
  if (onboardingPath === "trader") {
    // Trader path: brokerage step is final (signal creation is optional)
  } else {
    // Copier path: after brokerage, done
  }
}
```

Fix:
```typescript
function handleBrokerageComplete() {
  if (onboardingPath === "trader") {
    // Trader path: advance to optional signal creation
    setCurrentStep("create_signal");
  } else {
    // Copier path: dismiss wizard (full page reload to pick up onboarding_complete)
    window.location.reload();
  }
}
```

**Bug 3: `handleSkip` is a no-op**

Lines 77-80 currently:
```typescript
function handleSkip() {
  // User skipped — dismiss wizard without setting path
}
```

Fix:
```typescript
function handleSkip() {
  // Dismiss wizard and reload — server will re-evaluate onboarding state
  window.location.reload();
}
```

**Bug 4: Misleading comment in `handleCreateSignalComplete`**

Line 74 currently says `finishOnboarding('copier')` — should be `finishOnboarding('trader')`.

Fix the comment:
```typescript
function handleCreateSignalComplete() {
  // Trader signal creation is optional — wizard was already completed in
  // ConnectBrokerageStep via finishOnboarding('trader'). This handler just
  // dismisses the wizard after an optional signal is created.
  window.location.reload();
}
```

---

### 3. `/home/claude/TraderBase/src/components/plaid/BrokerageConnector.tsx`

**Add `onExit?: () => void` prop** to handle the Plaid-closed-without-connecting dead end.

Interface update:
```typescript
interface BrokerageConnectorProps {
  onConnected?: () => void;
  onExit?: () => void;   // ADD
  skipReload?: boolean;
}
```

Call it in the Plaid `onExit` callback:
```typescript
onExit: (err, metadata) => {
  setIsLoading(false);
  onExit?.();
},
```

Then in `ConnectBrokerageStep.tsx`, pass `onExit={onSkip}` to `BrokerageConnector`:
```typescript
<BrokerageConnector
  onConnected={handleConnected}
  onExit={onSkip}       // closed without connecting = skip
  skipReload={true}
/>
```

---

## Summary of All File Changes

| File | Change |
|------|--------|
| `/home/claude/TraderBase/src/components/onboarding/steps/ConnectBrokerageStep.tsx` | Add `stepError` state; check `finishOnboarding` result; pass `onExit={onSkip}` to `BrokerageConnector` |
| `/home/claude/TraderBase/src/components/onboarding/OnboardingWizard.tsx` | Make `handleBrokerageComplete` advance to `"create_signal"` for traders and reload for copiers; make `handleSkip` reload the page; fix misleading comment |
| `/home/claude/TraderBase/src/components/plaid/BrokerageConnector.tsx` | Add `onExit?: () => void` prop and invoke it in the Plaid `onExit` callback |

---

## Verification Checklist

**Scenario A: Trader connects brokerage successfully**
1. Complete path choice as trader, profile setup
2. On brokerage step, complete Plaid Link flow
3. **Expected:** No error shown; wizard advances to "Create Signal" step
4. **Expected:** `onboarding_step = 2` and `onboarding_complete = true` in DB
5. Click "Skip" on Create Signal step
6. **Expected:** Wizard dismisses, page reloads, dashboard visible, banner gone

**Scenario B: Trader skips brokerage**
1. Complete path choice as trader, profile setup
2. On brokerage step, click "Skip for now"
3. **Expected:** Wizard dismisses, page reloads, `onboarding_complete` still `false`
4. **Expected:** Wizard re-appears on next dashboard visit

**Scenario C: Plaid Link closed without connecting**
1. Complete path choice (trader or copier), reach brokerage step
2. Click "Link Brokerage", then close Plaid Link window
3. **Expected:** Wizard dismisses (via `onExit` → `onSkip` → reload)

**Scenario D: Copier connects brokerage successfully**
1. Complete path choice as copier, profile setup, browse traders
2. On brokerage step, complete Plaid Link flow
3. **Expected:** Wizard dismisses immediately
4. **Expected:** `onboarding_path = 'copier'` and `onboarding_complete = true` in DB

**Scenario E: `finishOnboarding` DB failure**
1. Reach brokerage step, break Supabase RLS policy or network
2. Complete Plaid Link
3. **Expected:** Error message shown in `ConnectBrokerageStep`; wizard stays on brokerage step, user can retry
4. **Expected:** Wizard does NOT dismiss; `onboarding_complete` remains `false`

**Scenario F: `createSignal` succeeds as trader**
1. Complete path choice as trader, profile setup, connect brokerage
2. Fill in signal form and submit
3. **Expected:** Signal created, wizard dismisses, dashboard shows new signal
