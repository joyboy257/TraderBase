import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatPercent, formatCompactNumber } from "@/lib/utils";
import { Users, TrendingUp, Zap } from "lucide-react";
import { FollowButton as FollowButtonGrid } from "@/components/social/FollowButtonGrid";
import { getTopTraders } from "@/lib/traders";

export default async function TradersPage() {
  const supabase = await createClient();

  // Use getTopTraders utility for consistent ordering
  const topTraders = await getTopTraders(20);

  const traderIds = topTraders.map(t => t.id);

  // Get signal counts for each trader
  const { data: signalCounts } = traderIds.length > 0
    ? await supabase
        .from("signals")
        .select("user_id")
        .in("user_id", traderIds)
        .eq("is_active", true)
    : { data: [] };

  // Count signals per user
  const signalCountMap: Record<string, number> = {};
  (signalCounts ?? []).forEach(s => {
    signalCountMap[s.user_id] = (signalCountMap[s.user_id] || 0) + 1;
  });

  // Build follower count for current user to know who's followed
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? "";
  const { data: myFollows } = await supabase
    .from("follows")
    .select("leader_id")
    .eq("follower_id", userId)
    .eq("is_active", true);

  const followedIds = new Set(myFollows?.map(f => f.leader_id) ?? []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-text-primary)] tracking-tight">
            Traders
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {topTraders.length} verified traders · All linked to live brokerage accounts
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="px-5 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[var(--color-accent-green-glow)] flex items-center justify-center">
            <Users size={14} className="text-[var(--color-accent-green)]" />
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Total Followers</p>
            <p className="font-data font-semibold text-[var(--color-text-primary)]">
              {formatCompactNumber(topTraders.reduce((sum, t) => sum + t.followers_count, 0))}
            </p>
          </div>
        </Card>
        <Card className="px-5 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[var(--color-accent-purple-glow)] flex items-center justify-center">
            <TrendingUp size={14} className="text-[var(--color-accent-purple)]" />
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Avg 30D Return</p>
            <p className="font-data font-semibold text-[var(--color-accent-green)]">—</p>
          </div>
        </Card>
        <Card className="px-5 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[rgba(255,71,87,0.1)] flex items-center justify-center">
            <Zap size={14} className="text-[var(--color-sell)]" />
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Signals Today</p>
            <p className="font-data font-semibold text-[var(--color-text-primary)]">
              {signalCounts?.length ?? 0}
            </p>
          </div>
        </Card>
      </div>

      {/* Traders grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {(topTraders ?? []).map((trader) => {
          const signalCount = signalCountMap[trader.id] || 0;
          const isFollowing = followedIds.has(trader.id);

          return (
            <Card key={trader.id} className="p-5 hover:border-[var(--color-border-default)] transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={trader.avatar_url}
                    alt={trader.display_name ?? trader.username}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-semibold text-[var(--color-text-primary)] truncate">
                        {trader.display_name ?? trader.username}
                      </span>
                      {trader.is_verified && <Badge variant="verified">Verified</Badge>}
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      @{trader.username}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-data font-bold text-xl text-[var(--color-text-muted)]">
                    —
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">30D Return</p>
                </div>
              </div>

              <div className="flex items-center gap-6 mb-4">
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Followers</p>
                  <p className="font-data font-semibold text-sm text-[var(--color-text-primary)]">
                    {formatCompactNumber(trader.followers_count)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Signals</p>
                  <p className="font-data font-semibold text-sm text-[var(--color-text-primary)]">
                    {signalCount}
                  </p>
                </div>
              </div>

              <FollowButtonGrid
                  leaderId={trader.id}
                  leaderUsername={trader.username}
                  isFollowing={isFollowing}
                  followerId={userId}
                />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
