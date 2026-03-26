"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { completeOnboardingStep } from "@/app/actions/onboarding";
import { fetchTopTraders } from "@/app/actions/traders";
import { formatCompactNumber } from "@/lib/utils";
import type { TopTrader } from "@/lib/traders";

interface BrowseTradersStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function BrowseTradersStep({ onComplete, onSkip }: BrowseTradersStepProps) {
  const [traders, setTraders] = useState<TopTrader[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const data = await fetchTopTraders(6);
      setTraders(data ?? []);
      setIsLoading(false);
    }
    load();
  }, []);

  async function handleFollow(traderId: string) {
    startTransition(async () => {
      const method = followedIds.has(traderId) ? "DELETE" : "POST";
      const res = await fetch("/api/follow", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leader_id: traderId }),
      });
      if (res.ok) {
        setFollowedIds((prev) => {
          const next = new Set(prev);
          if (next.has(traderId)) next.delete(traderId);
          else next.add(traderId);
          return next;
        });
      }
    });
  }

  function handleNext() {
    completeOnboardingStep(1);
    onComplete();
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-2xl text-[var(--color-text-primary)] mb-2">
          Discover traders to follow
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Follow at least one trader to continue. You can skip if you prefer.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-[var(--color-bg-elevated)] rounded-lg">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          ))}
        </div>
      ) : traders.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-[var(--color-text-muted)] mb-4">No traders found</p>
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Skip for now
          </Button>
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {traders.map((trader) => (
            <div key={trader.id} className="flex items-center gap-3 p-3 bg-[var(--color-bg-elevated)] rounded-lg">
              <Avatar
                src={trader.avatar_url}
                alt={trader.display_name ?? trader.username}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                    {trader.display_name ?? trader.username}
                  </span>
                  {trader.is_verified && <Badge variant="verified">Verified</Badge>}
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">
                  @{trader.username} · {formatCompactNumber(trader.followers_count)} followers
                </span>
              </div>
              <Button
                variant={followedIds.has(trader.id) ? "secondary" : "primary"}
                size="sm"
                onClick={() => handleFollow(trader.id)}
                disabled={isPending}
              >
                {followedIds.has(trader.id) ? "Following" : "Follow"}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
          Skip
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={followedIds.size === 0}
          onClick={handleNext}
          className="flex-1"
        >
          {followedIds.size > 0 ? `Continue (${followedIds.size} following)` : "Continue"}
        </Button>
      </div>
    </div>
  );
}
