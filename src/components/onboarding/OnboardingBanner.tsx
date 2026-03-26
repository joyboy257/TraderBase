"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ArrowRight, TrendingUp, Users } from "lucide-react";
import type { OnboardingProfile } from "./OnboardingWizard";

interface Signal {
  id: string;
  user_id: string;
}

interface Follow {
  leader_id: string;
}

interface OnboardingBannerProps {
  profile: OnboardingProfile;
  signals: Signal[];
  follows: Follow[];
}

export function OnboardingBanner({ profile, signals, follows }: OnboardingBannerProps) {
  const traderActionTaken = signals.some((s) => s.user_id === profile.id);
  const copierActionTaken = follows.length > 0;

  const showBanner =
    profile.onboarding_complete &&
    ((profile.onboarding_path === "trader" && !traderActionTaken) ||
      (profile.onboarding_path === "copier" && !copierActionTaken));

  if (!showBanner) return null;

  if (profile.onboarding_path === "trader") {
    return (
      <Card className="p-4 border-[var(--color-accent-green)] bg-[var(--color-accent-green-glow)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--color-accent-green)]/20 flex items-center justify-center">
              <TrendingUp size={16} className="text-[var(--color-accent-green)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Create your first signal
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Share your trade ideas with the community
              </p>
            </div>
          </div>
          <Link href="/signals">
            <Button size="sm" variant="secondary">
              Get started
              <ArrowRight size={14} />
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  if (profile.onboarding_path === "copier") {
    return (
      <Card className="p-4 border-[var(--color-accent-purple)] bg-[var(--color-accent-purple-glow)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--color-accent-purple)]/20 flex items-center justify-center">
              <Users size={16} className="text-[var(--color-accent-purple)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Discover traders to follow
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Find top traders and start copying their trades
              </p>
            </div>
          </div>
          <Link href="/traders">
            <Button size="sm" variant="secondary">
              Find traders
              <ArrowRight size={14} />
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return null;
}
