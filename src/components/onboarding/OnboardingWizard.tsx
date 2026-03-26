"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { PathChoiceStep } from "./steps/PathChoiceStep";
import { ProfileSetupStep } from "./steps/ProfileSetupStep";
import { BrowseTradersStep } from "./steps/BrowseTradersStep";
import { ConnectBrokerageStep } from "./steps/ConnectBrokerageStep";
import { CreateSignalStep } from "./steps/CreateSignalStep";

export interface OnboardingProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  onboarding_complete: boolean;
  onboarding_path: "trader" | "copier" | null;
  onboarding_step: number;
}

interface OnboardingWizardProps {
  profile: OnboardingProfile;
}

type WizardStep = "path" | "profile" | "browse" | "brokerage" | "create_signal";

function stepForPath(path: "trader" | "copier", step: number): WizardStep {
  if (step === 0) return "path";
  if (step === 1) return "profile";
  if (step === 2) return "brokerage";
  return path === "copier" ? "brokerage" : "create_signal";
}

export function OnboardingWizard({ profile }: OnboardingWizardProps) {
  const [mounted, setMounted] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>(
    profile.onboarding_path
      ? stepForPath(profile.onboarding_path, profile.onboarding_step)
      : "path"
  );
  const [onboardingPath, setOnboardingPath] = useState<"trader" | "copier" | null>(
    profile.onboarding_path
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  function handlePathChosen(path: "trader" | "copier") {
    setOnboardingPath(path);
    setCurrentStep("profile");
  }

  function handleProfileComplete() {
    setCurrentStep(onboardingPath === "copier" ? "browse" : "brokerage");
  }

  function handleBrowseComplete() {
    setCurrentStep("brokerage");
  }

  function handleBrokerageComplete() {
    if (onboardingPath === "trader") {
      // Trader path: brokerage step is final (signal creation is optional)
      // finishOnboarding('trader') is called inside ConnectBrokerageStep
    } else {
      // Copier path: after brokerage, done
    }
  }

  function handleCreateSignalComplete() {
    // finishOnboarding('copier') is called inside CreateSignalStep
  }

  function handleSkip() {
    // User skipped — dismiss wizard without setting path
    // The banner will guide them later
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative w-full max-w-lg mx-4 bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl shadow-2xl">
        {/* Step indicator */}
        <div className="flex items-center gap-1 px-6 pt-6">
          {["path", "profile", onboardingPath === "copier" ? "browse" : "brokerage", onboardingPath === "trader" ? "create_signal" : null].filter(Boolean).map((_, i, arr) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`h-1 w-8 rounded-full ${i <= (currentStep === "create_signal" ? 3 : currentStep === "brokerage" ? 2 : currentStep === "browse" ? 2 : currentStep === "profile" ? 1 : 0) ? "bg-[var(--color-accent-green)]" : "bg-[var(--color-bg-elevated)]"}`} />
            </div>
          ))}
          <span className="ml-auto text-xs text-[var(--color-text-muted)]">
            {currentStep === "path" ? "Step 1 of 3" : currentStep === "profile" ? "Step 2 of 3" : "Step 3 of 3"}
          </span>
        </div>

        {/* Step content */}
        <div className="p-6">
          {currentStep === "path" && (
            <PathChoiceStep onPathChosen={handlePathChosen} />
          )}
          {currentStep === "profile" && (
            <ProfileSetupStep
              profile={profile}
              onComplete={handleProfileComplete}
              onSkip={handleSkip}
            />
          )}
          {currentStep === "browse" && (
            <BrowseTradersStep
              onComplete={handleBrowseComplete}
              onSkip={handleSkip}
            />
          )}
          {currentStep === "brokerage" && (
            <ConnectBrokerageStep
              path={onboardingPath!}
              onComplete={handleBrokerageComplete}
              onSkip={handleSkip}
            />
          )}
          {currentStep === "create_signal" && (
            <CreateSignalStep
              onComplete={handleCreateSignalComplete}
              onSkip={handleSkip}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
