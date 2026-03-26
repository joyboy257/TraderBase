import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TrendingUp, Users, Target, BarChart2, ArrowLeft } from "lucide-react";
import { FollowButton } from "@/components/social/FollowButton";
import { CopySignalButton } from "@/components/social/CopySignalButton";
import { formatPercent, formatCompactNumber, timeAgo } from "@/lib/utils";

export default async function TraderProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch trader profile
  const { data: trader } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  if (!trader) {
    notFound();
  }

  // Fetch trader's signals
  const { data: signals } = await supabase
    .from("signals")
    .select("*")
    .eq("user_id", trader.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(10);

  // Check if current user follows this trader
  const { data: follow } = user
    ? await supabase
        .from("follows")
        .select("*")
        .eq("follower_id", user.id)
        .eq("leader_id", trader.id)
        .single()
    : { data: null };

  // Get follower count
  const { count: followerCount } = await supabase
    .from("follows")
    .select("leader_id", { count: "exact", head: true })
    .eq("leader_id", trader.id)
    .eq("is_active", true);

  // TODO: Stats like return30d, returnAllTime, win_rate need columns in profiles table or a separate stats table
  // Showing placeholder values since these require historical P&L calculation
  const stats = {
    return30d: null,
    returnAllTime: null,
    winRate: null,
    totalTrades: signals?.length ?? 0,
  };

  return (
    <div className="p-8">
      {/* Back button */}
      <a href="/traders" className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-5 transition-colors">
        <ArrowLeft size={14} />
        Back to Traders
      </a>

      {/* Profile header */}
      <Card className="p-8 mb-6">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <Avatar
            src={trader.avatar_url}
            alt={trader.display_name ?? trader.username}
            size="xl"
            className="w-24 h-24"
          />
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-display text-3xl text-[var(--color-text-primary)]">
                {trader.display_name ?? trader.username}
              </h1>
              {trader.is_verified && <Badge variant="verified">Verified Trader</Badge>}
            </div>
            <p className="text-[var(--color-text-secondary)] mb-4">
              @{trader.username}
            </p>
            {trader.bio && (
              <p className="text-[var(--color-text-secondary)] mb-4 max-w-2xl">
                {trader.bio}
              </p>
            )}

            <div className="flex items-center gap-6 text-sm text-[var(--color-text-muted)]">
              <span>
                <strong className="text-[var(--color-text-primary)]">{formatCompactNumber(followerCount ?? 0)}</strong> followers
              </span>
              <span>
                <strong className="text-[var(--color-text-primary)]">{signals?.length ?? 0}</strong> signals
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <FollowButton
              leaderId={trader.id}
              leaderUsername={trader.username}
              isFollowing={!!follow}
              followerId={user?.id ?? ""}
            />
            {!follow && signals && signals.length > 0 && (
              <CopySignalButton
                signalId={signals[0].id}
                ticker={signals[0].ticker}
                action={signals[0].action}
                followerId={user?.id ?? ""}
              />
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8 pt-8 border-t border-[var(--color-border-subtle)]">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={12} className="text-[var(--color-text-muted)]" />
              <span className="text-xs text-[var(--color-text-muted)]">30D Return</span>
            </div>
            <span className="font-data text-2xl font-bold text-[var(--color-text-muted)]">
              {stats.return30d != null ? formatPercent(stats.return30d) : "—"}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart2 size={12} className="text-[var(--color-text-muted)]" />
              <span className="text-xs text-[var(--color-text-muted)]">All-Time Return</span>
            </div>
            <span className="font-data text-2xl font-bold text-[var(--color-text-muted)]">
              {stats.returnAllTime != null ? formatPercent(stats.returnAllTime) : "—"}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Target size={12} className="text-[var(--color-text-muted)]" />
              <span className="text-xs text-[var(--color-text-muted)]">Win Rate</span>
            </div>
            <span className="font-data text-2xl font-bold text-[var(--color-text-muted)]">
              {stats.winRate != null ? `${stats.winRate}%` : "—"}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Users size={12} className="text-[var(--color-text-muted)]" />
              <span className="text-xs text-[var(--color-text-muted)]">Followers</span>
            </div>
            <span className="font-data text-2xl font-bold text-[var(--color-text-primary)]">
              {formatCompactNumber(followerCount ?? 0)}
            </span>
          </div>
        </div>
      </Card>

      {/* Recent Signals */}
      <div className="mb-8">
        <h2 className="font-display text-xl text-[var(--color-text-primary)] mb-4">
          Recent Signals
        </h2>
        <div className="space-y-3">
          {signals && signals.length > 0 ? (
            signals.map((signal) => (
              <Card key={signal.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Badge variant={signal.action === "BUY" ? "buy" : "sell"}>
                      {signal.action}
                    </Badge>
                    <span className="font-data font-bold text-lg text-[var(--color-text-primary)]">
                      {signal.ticker}
                    </span>
                    <div>
                      <span className="font-data text-sm text-[var(--color-text-secondary)]">
                        Entry: ${signal.entry_price?.toFixed(2) ?? "—"}
                      </span>
                      {signal.stop_loss && (
                        <span className="font-data text-sm text-[var(--color-sell)] ml-3">
                          SL: ${signal.stop_loss.toFixed(2)}
                        </span>
                      )}
                      {signal.take_profit && (
                        <span className="font-data text-sm text-[var(--color-accent-green)] ml-3">
                          TP: ${signal.take_profit.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-[var(--color-text-muted)]">
                      {timeAgo(signal.created_at)}
                    </span>
                    {signal.is_verified && <Badge variant="verified">Verified</Badge>}
                    <CopySignalButton
                      signalId={signal.id}
                      ticker={signal.ticker}
                      action={signal.action}
                      followerId={user?.id ?? ""}
                    />
                  </div>
                </div>
                {signal.rationale && (
                  <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                    {signal.rationale}
                  </p>
                )}
              </Card>
            ))
          ) : (
            <Card className="p-8 text-center">
              <p className="text-[var(--color-text-muted)]">
                No active signals from this trader.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
