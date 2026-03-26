import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MarketMovers } from "@/components/market/MarketMovers";
import { CopySignalButton } from "@/components/social/CopySignalButton";
import { formatCurrency, formatPercent, timeAgo } from "@/lib/utils";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Users,
  Zap,
} from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? "";

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", userId)
    .single();

  // Fetch positions for portfolio value and P&L
  // TODO: Table positions needs current_price and unrealized_pnl populated by a server process

  // All queries run in parallel — none depend on each other's results
  const [positionsResult, signalsResult, followedLeadersResult] = await Promise.all([
    supabase
      .from("positions")
      .select("current_price, unrealized_pnl, quantity")
      .eq("user_id", userId),
    supabase
      .from("signals")
      .select("*, profiles:user_id(id, username, display_name, avatar_url, is_verified)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("follows")
      .select("leader_id, copy_ratio, profiles:leader_id(id, username, display_name, avatar_url)")
      .eq("follower_id", userId)
      .eq("is_active", true)
      .limit(2),
  ]);

  const positions = positionsResult.data;
  const signals = signalsResult.data;
  const followedLeaders = followedLeadersResult.data as { leader_id: string; copy_ratio: number; profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null }[] | null;

  const portfolioValue = positions?.reduce(
    (sum, p) => sum + (Number(p.quantity || 0) * Number(p.current_price || 0)),
    0
  ) ?? 0;
  const totalUnrealizedPnl = positions?.reduce((sum, p) => sum + Number(p.unrealized_pnl || 0), 0) ?? 0;
  const isUp = totalUnrealizedPnl >= 0;

  return (
    <div className="space-y-6">
      {/* Portfolio Hero Row */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-widest mb-2">
            Portfolio Value
          </p>
          <div className="flex items-baseline gap-4">
            <span className="font-data text-5xl font-bold text-[var(--color-text-primary)] tracking-tight">
              {formatCurrency(portfolioValue)}
            </span>
            <div className="flex items-center gap-1.5">
              {isUp ? (
                <TrendingUp size={18} className="text-[var(--color-accent-green)]" />
              ) : (
                <TrendingDown size={18} className="text-[var(--color-sell)]" />
              )}
              <span className={`font-data text-lg font-semibold ${isUp ? "text-[var(--color-accent-green)]" : "text-[var(--color-sell)]"}`}>
                {isUp ? "+" : ""}{formatCurrency(totalUnrealizedPnl)} (0.00%)
              </span>
              <span className="text-sm text-[var(--color-text-muted)]">today</span>
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Unrealized P&L: {totalUnrealizedPnl >= 0 ? "+" : ""}{formatCurrency(totalUnrealizedPnl)} · Real-time via Plaid
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/portfolio">
            <Button variant="secondary" size="sm">
              View Portfolio
            </Button>
          </Link>
          <Link href="/settings">
            <Button size="sm">
              Link Brokerage
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Signals Feed */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-[var(--color-accent-green)]" />
              <h2 className="font-semibold text-[var(--color-text-primary)]">Active Signals</h2>
              <span className="text-[10px] font-semibold tracking-widest uppercase text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 rounded">
                Live
              </span>
            </div>
            <Link href="/signals" className="flex items-center gap-1 text-xs text-[var(--color-accent-purple)] hover:underline">
              All signals
              <ArrowRight size={12} />
            </Link>
          </div>

          <div className="space-y-3">
            {(signals ?? []).map((signal) => {
              const profile = signal.profiles;
              const entryPrice = Number(signal.entry_price || 0);
              const currentPrice = Number(signal.current_price || entryPrice);
              const returnPct = entryPrice > 0
                ? (signal.action === "BUY"
                  ? ((currentPrice - entryPrice) / entryPrice) * 100
                  : ((entryPrice - currentPrice) / entryPrice) * 100)
                : 0;

              return (
                <Card key={signal.id} className="p-4 hover:border-[var(--color-border-default)] transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    {/* Trader info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Avatar
                        src={profile?.avatar_url}
                        alt={profile?.display_name ?? profile?.username}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                            {profile?.display_name ?? profile?.username}
                          </span>
                          {profile?.is_verified && (
                            <Badge variant="verified">Verified</Badge>
                          )}
                          <span className="text-xs text-[var(--color-text-muted)]">
                            @{profile?.username}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-1">
                          {signal.rationale}
                        </p>
                      </div>
                    </div>

                    {/* Trade info */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <Badge variant={signal.action === "BUY" ? "buy" : "sell"}>
                          {signal.action}
                        </Badge>
                        <div className="mt-1">
                          <span className="font-data font-bold text-[var(--color-text-primary)] text-base">
                            {signal.ticker}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-data text-xs text-[var(--color-text-muted)] mb-0.5">Entry</p>
                        <p className="font-data text-sm text-[var(--color-text-secondary)]">
                          ${entryPrice.toFixed(2)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-data text-xs text-[var(--color-text-muted)] mb-0.5">Now</p>
                        <p className="font-data text-sm text-[var(--color-text-primary)]">
                          ${currentPrice.toFixed(2)}
                        </p>
                      </div>

                      <div className="text-right w-16">
                        <p className="font-data text-xs text-[var(--color-text-muted)] mb-0.5">Return</p>
                        <p className={`font-data font-semibold text-sm ${returnPct >= 0 ? "text-[var(--color-accent-green)]" : "text-[var(--color-sell)]"}`}>
                          {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(2)}%
                        </p>
                      </div>

                      <CopySignalButton
                        signalId={signal.id}
                        ticker={signal.ticker}
                        action={signal.action}
                        followerId={userId}
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right: Market + Traders */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {/* Market Movers */}
          <MarketMovers />

          {/* Your Traders */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-[var(--color-accent-purple)]" />
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Your Traders
                </h3>
              </div>
              <Link href="/traders" className="text-xs text-[var(--color-accent-purple)] hover:underline">
                Find more
              </Link>
            </div>

            <div className="space-y-3">
              {(followedLeaders ?? []).map((follow) => {
                const leader = follow.profiles;
                return leader ? (
                  <div key={follow.leader_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        src={leader.avatar_url}
                        alt={leader.display_name ?? leader.username}
                        size="sm"
                      />
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text-primary)] leading-none mb-0.5">
                          {leader.display_name ?? leader.username}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {(Number(follow.copy_ratio) * 100).toFixed(0)}% copy
                        </p>
                      </div>
                    </div>
                    <span className="font-data text-sm font-semibold text-[var(--color-accent-green)]">
                      —
                    </span>
                  </div>
                ) : null;
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
