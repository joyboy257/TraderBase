"use client";

import { useState, useTransition } from "react";
import { BrokerageConnector } from "@/components/plaid/BrokerageConnector";
import { Button } from "@/components/ui/Button";
import { completeOnboardingStep, finishOnboarding } from "@/app/actions/onboarding";
import { Building2 } from "lucide-react";

interface ConnectBrokerageStepProps {
  path: "trader" | "copier";
  onComplete: () => void;
  onSkip: () => void;
}

export function ConnectBrokerageStep({ path, onComplete, onSkip }: ConnectBrokerageStepProps) {
  const [isPending, startTransition] = useTransition();
  const [stepError, setStepError] = useState<string | null>(null);

  async function handleConnected() {
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

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-2xl text-[var(--color-text-primary)] mb-2">
          {path === "trader"
            ? "Connect your brokerage"
            : "Connect to enable copying"}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          {path === "trader"
            ? "Link your brokerage to share verified positions and build trust with followers."
            : "Connect a brokerage to automatically copy trades from traders you follow."}
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 py-4">
        <div className="w-16 h-16 rounded-full bg-[var(--color-accent-green-glow)] flex items-center justify-center">
          <Building2 size={28} className="text-[var(--color-accent-green)]" />
        </div>
        <BrokerageConnector
          onConnected={handleConnected}
          onExit={onSkip}
          skipReload={true}
        />
        {stepError && (
          <p className="text-sm text-[var(--color-sell)] text-center">{stepError}</p>
        )}
      </div>

      <Button type="button" variant="ghost" size="sm" onClick={onSkip} className="w-full">
        Skip for now — you can link later
      </Button>
    </div>
  );
}
