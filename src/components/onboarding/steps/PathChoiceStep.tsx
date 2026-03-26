"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { finishOnboarding } from "@/app/actions/onboarding";
import { TrendingUp, Users } from "lucide-react";

interface PathChoiceStepProps {
  onPathChosen: (path: "trader" | "copier") => void;
}

export function PathChoiceStep({ onPathChosen }: PathChoiceStepProps) {
  const [isPending, startTransition] = useTransition();

  function selectPath(path: "trader" | "copier") {
    startTransition(async () => {
      await finishOnboarding(path);
      onPathChosen(path);
    });
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-2xl text-[var(--color-text-primary)] mb-2">
          What would you like to do?
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Choose your path. You can always change this later.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Trader path */}
        <button
          onClick={() => selectPath("trader")}
          disabled={isPending}
          className="flex flex-col items-center gap-3 p-6 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-xl hover:border-[var(--color-accent-green)] hover:shadow-[var(--shadow-green)] transition-all group disabled:opacity-50"
        >
          <div className="w-12 h-12 rounded-full bg-[var(--color-accent-green-glow)] flex items-center justify-center">
            <TrendingUp size={22} className="text-[var(--color-accent-green)]" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-[var(--color-text-primary)] mb-1">Share trades</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Create signals, build a following
            </p>
          </div>
        </button>

        {/* Copier path */}
        <button
          onClick={() => selectPath("copier")}
          disabled={isPending}
          className="flex flex-col items-center gap-3 p-6 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-xl hover:border-[var(--color-accent-purple)] hover:shadow-[var(--shadow-purple)] transition-all group disabled:opacity-50"
        >
          <div className="w-12 h-12 rounded-full bg-[var(--color-accent-purple-glow)] flex items-center justify-center">
            <Users size={22} className="text-[var(--color-accent-purple)]" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-[var(--color-text-primary)] mb-1">Copy traders</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Follow traders, mirror their positions
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
