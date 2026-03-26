"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { saveProfile } from "@/app/actions/settings";
import { completeOnboardingStep } from "@/app/actions/onboarding";
import type { OnboardingProfile } from "../OnboardingWizard";

interface ProfileSetupStepProps {
  profile: OnboardingProfile;
  onComplete: () => void;
  onSkip: () => void;
}

export function ProfileSetupStep({ profile, onComplete, onSkip }: ProfileSetupStepProps) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("display_name", displayName);
      formData.set("bio", bio);
      formData.set("username", profile.username ?? "");

      const result = await saveProfile(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      await completeOnboardingStep(1);
      onComplete();
    });
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-2xl text-[var(--color-text-primary)] mb-2">
          Set up your profile
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Let others know who you are. You can always update this later.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
          maxLength={30}
          error={error ?? undefined}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">
            Bio <span className="text-[var(--color-text-muted)]">(optional)</span>
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell others about yourself..."
            maxLength={500}
            rows={3}
            className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-md text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] text-sm resize-none focus:outline-none focus:border-[var(--color-accent-green)] focus:ring-1 focus:ring-[var(--color-accent-green)] transition-colors"
          />
          <span className="text-xs text-[var(--color-text-muted)] text-right">
            {bio.length}/500
          </span>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
            Skip
          </Button>
          <Button type="submit" size="sm" disabled={isPending} className="flex-1">
            {isPending ? "Saving..." : "Continue"}
          </Button>
        </div>
      </form>
    </div>
  );
}
