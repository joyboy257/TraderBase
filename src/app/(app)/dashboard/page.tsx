import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { formatCurrency, formatPercent, timeAgo } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const userId = user?.id ?? "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  const { data: signals } = await supabase
    .from("signals")
    .select("*, profiles:user_id(username, display_name, avatar_url)")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: follows } = await supabase
    .from("follows")
    .select("*, leader:leader_id(username, display_name, avatar_url)")
    .eq("follower_id", userId)
    .eq("is_active", true)
    .limit(5);

  const portfolioValue = 12450.67;
  const portfolioChange = 2.34;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl text-[var(--color-text-primary)] mb-2">
          Welcome back, {profile?.display_name ? profile.display_name.split(" ")[0] : "Trader"}
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Here&apos;s what&apos;s happening with your portfolio today.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-6">
          <span className="text-xs text-[var(--color-text-muted)] block mb-2">
            Portfolio Value
          </span>
          <span className="font-data text-2xl font-bold text-[var(--color-text-primary)]">
            {formatCurrency(portfolioValue)}
          </span>
          <span className={`font-data text-sm ${portfolioChange >= 0 ? "text-[var(--color-accent-green)]" : "text-[var(--color-sell)]"}`}>
            {" "}{formatPercent(portfolioChange)}
          </span>
        </Card>

        <Card className="p-6">
          <span className="text-xs text-[var(--color-text-muted)] block mb-2">
            Traders Following
          </span>
          <span className="font-data text-2xl font-bold text-[var(--color-text-primary)]">
            {follows ? follows.length : 0}
          </span>
        </Card>

        <Card className="p-6">
          <span className="text-xs text-[var(--color-text-muted)] block mb-2">
            Active Signals
          </span>
          <span className="font-data text-2xl font-bold text-[var(--color-text-primary)]">
            {signals ? signals.length : 0}
          </span>
        </Card>

        <Card className="p-6">
          <span className="text-xs text-[var(--color-text-muted)] block mb-2">
            Copy Trading
          </span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--color-accent-green)]" />
            <span className="text-sm text-[var(--color-text-secondary)]">Active</span>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Active Signals */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl text-[var(--color-text-primary)]">
              Active Signals
            </h2>
            <a href="/signals" className="text-sm text-[var(--color-accent-purple)] hover:underline">
              View all
            </a>
          </div>

          <div className="space-y-3">
            {signals && signals.length > 0 ? (
              signals.map((signal) => (
                <Card key={signal.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Avatar
                        src={signal.profiles?.avatar_url}
                        alt={signal.profiles?.display_name ? signal.profiles.display_name : "Trader"}
                        size="sm"
                      />
                      <div>
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                          {signal.profiles?.display_name}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)] ml-2">
                          @{signal.profiles?.username}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {timeAgo(signal.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={signal.action === "BUY" ? "buy" : "sell"}>
                        {signal.action}
                      </Badge>
                      <span className="font-data font-bold text-[var(--color-text-primary)]">
                        {signal.ticker}
                      </span>
                      <span className="font-data text-sm text-[var(--color-text-secondary)]">
                        ${signal.entry_price ? signal.entry_price.toFixed(2) : "—"}
                      </span>
                    </div>
                    <button className="px-3 py-1.5 text-xs font-semibold rounded-md bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-green)] hover:text-[var(--color-bg-base)] transition-colors">
                      Copy
                    </button>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center">
                <p className="text-[var(--color-text-muted)]">
                  No active signals yet. Follow some traders to see their signals here.
                </p>
              </Card>
            )}
          </div>
        </section>

        {/* Your Traders */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl text-[var(--color-text-primary)]">
              Your Traders
            </h2>
            <a href="/traders" className="text-sm text-[var(--color-accent-purple)] hover:underline">
              Find more
            </a>
          </div>

          <div className="space-y-3">
            {follows && follows.length > 0 ? (
              follows.map((follow) => (
                <Card key={follow.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={follow.leader?.avatar_url}
                        alt={follow.leader?.display_name ? follow.leader.display_name : "Trader"}
                        size="md"
                      />
                      <div>
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                          {follow.leader?.display_name}
                        </span>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          @{follow.leader?.username}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
                        {(Number(follow.copy_ratio) * 100).toFixed(0)}% copy
                      </span>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center">
                <p className="text-[var(--color-text-muted)] mb-4">
                  You&apos;re not following any traders yet.
                </p>
                <a href="/traders" className="text-sm text-[var(--color-accent-green)] hover:underline">
                  Discover top traders
                </a>
              </Card>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
