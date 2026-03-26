import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { formatPercent, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default async function SignalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: signals } = await supabase
    .from("signals")
    .select("*, profiles:user_id(username, display_name, avatar_url, is_verified)")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: userFollows } = await supabase
    .from("follows")
    .select("leader_id")
    .eq("follower_id", user!.id)
    .eq("is_active", true);

  const followedLeaderIds = new Set(userFollows?.map(f => f.leader_id) ?? []);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-[var(--color-text-primary)] mb-2">
            Signals
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            Real-time trade alerts from verified traders
          </p>
        </div>
        <Button>Create Signal</Button>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <Input
            placeholder="Search ticker (e.g. AAPL)"
            className="w-48"
          />
          <div className="flex items-center gap-2">
            {["All", "BUY", "SELL"].map((filter) => (
              <button
                key={filter}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filter === "All"
                    ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                    : filter === "BUY"
                    ? "bg-[var(--color-accent-green-glow)] text-[var(--color-accent-green)]"
                    : "bg-[rgba(255,71,87,0.15)] text-[var(--color-sell)]"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-[var(--color-accent-green)]" />
            Verified only
          </label>
        </div>
      </Card>

      {/* Signals table */}
      <Card>
        {/* Table header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-[var(--color-border-subtle)] text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          <div className="col-span-3">Trader</div>
          <div className="col-span-2">Ticker</div>
          <div className="col-span-2">Action</div>
          <div className="col-span-2">Entry Price</div>
          <div className="col-span-1">Verified</div>
          <div className="col-span-1">Time</div>
          <div className="col-span-1"></div>
        </div>

        {/* Table rows */}
        <div className="divide-y divide-[var(--color-border-subtle)]">
          {signals && signals.length > 0 ? (
            signals.map((signal) => (
              <div
                key={signal.id}
                className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-[var(--color-bg-elevated)] transition-colors items-center"
              >
                {/* Trader */}
                <div className="col-span-3 flex items-center gap-3">
                  <Avatar
                    src={signal.profiles?.avatar_url}
                    alt={signal.profiles?.display_name ?? "Trader"}
                    size="sm"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {signal.profiles?.display_name}
                      </span>
                      {signal.profiles?.is_verified && (
                        <Badge variant="verified">V</Badge>
                      )}
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      @{signal.profiles?.username}
                    </span>
                  </div>
                </div>

                {/* Ticker */}
                <div className="col-span-2">
                  <span className="font-data font-bold text-[var(--color-text-primary)]">
                    {signal.ticker}
                  </span>
                </div>

                {/* Action */}
                <div className="col-span-2">
                  <Badge variant={signal.action === "BUY" ? "buy" : "sell"}>
                    {signal.action}
                  </Badge>
                </div>

                {/* Entry Price */}
                <div className="col-span-2">
                  <span className="font-data text-sm text-[var(--color-text-primary)]">
                    ${signal.entry_price?.toFixed(2) ?? "—"}
                  </span>
                  {signal.stop_loss && (
                    <div className="text-xs text-[var(--color-text-muted)]">
                      SL: ${signal.stop_loss.toFixed(2)}
                    </div>
                  )}
                </div>

                {/* Verified */}
                <div className="col-span-1">
                  {signal.is_verified ? (
                    <Badge variant="verified">Yes</Badge>
                  ) : (
                    <span className="text-xs text-[var(--color-text-muted)]">—</span>
                  )}
                </div>

                {/* Time */}
                <div className="col-span-1">
                  <span className="text-sm text-[var(--color-text-muted)]">
                    {timeAgo(signal.created_at)}
                  </span>
                </div>

                {/* Copy button */}
                <div className="col-span-1">
                  <Button
                    size="sm"
                    variant={followedLeaderIds.has(signal.user_id) ? "secondary" : "primary"}
                    disabled={!followedLeaderIds.has(signal.user_id)}
                  >
                    {followedLeaderIds.has(signal.user_id) ? "Copy" : "Follow first"}
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-16 text-center">
              <p className="text-[var(--color-text-muted)]">
                No signals yet. Be the first to share a trade!
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
