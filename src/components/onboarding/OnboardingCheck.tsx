"use client";

import { OnboardingWizard } from "./OnboardingWizard";
import { OnboardingBanner } from "./OnboardingBanner";
import type { OnboardingProfile } from "./OnboardingWizard";

interface OnboardingCheckProps {
  profile: OnboardingProfile;
  userSignals: { id: string; user_id: string }[];
  followedLeaders: { leader_id: string }[];
}

export function OnboardingCheck({ profile, userSignals, followedLeaders }: OnboardingCheckProps) {
  if (!profile.onboarding_complete) {
    return <OnboardingWizard profile={profile} />;
  }

  return (
    <OnboardingBanner
      profile={profile}
      signals={userSignals}
      follows={followedLeaders}
    />
  );
}
