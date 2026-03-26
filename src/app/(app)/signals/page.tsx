import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatPercent, timeAgo } from "@/lib/utils";
import { Filter, ArrowUpDown } from "lucide-react";

export default async function SignalsPage() {
  const supabase = await createClient();

  // Run auth and signals query in parallel
  const [{ data: { user } }, { data: signals }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("signals")
      .select("*, profiles:user_id(id, username, display_name, avatar_url, is_verified)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const userId = user?.id ?? "";

  // Check which signals the current user is following
  const { data: followedSignals } = await supabase
    .from("follows")
    .select("leader_id")
    .eq("follower_id", userId)
    .eq("is_active", true);

  const followedIds = new Set(followedSignals?.map(f => f.leader_id) ?? []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-text-primary)] tracking-tight">
            Signals
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {(signals ?? []).length} active signals · Real-time via verified brokerages
          </p>
        </div>
        <Button size="sm">Create Signal</Button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search ticker..."
          className="w-48"
        />
        <div className="flex items-center gap-1">
          {["All", "BUY", "SELL"].map((f) => (
            <button
              key={f}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                f === "All"
                  ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                  : f === "BUY"
                  ? "bg-[var(--color-accent-green-glow)] text-[var(--color-accent-green)]"
                  : "bg-[rgba(255,71,87,0.15)] text-[var(--color-sell)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer ml-auto">
          <input type="checkbox" className="w-3.5 h-3.5 accent-[var(--color-accent-green)]" />
          Verified only
        </label>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
          {[
            { label: "Trader", col: "col-span-3" },
            { label: "Ticker", col: "col-span-1" },
            { label: "Action", col: "col-span-1" },
            { label: "Entry", col: "col-span-1" },
            { label: "Current", col: "col-span-1" },
            { label: "Return", col: "col-span-1" },
            { label: "Stop Loss", col: "col-span-1" },
            { label: "Time", col: "col-span-1" },
            { label: "", col: "col-span-2" },
          ].map(({ label, col }) => (
            <div key={label} className={`${col} text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]`}>
              {label}
            </div>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-[var(--color-border-subtle)]">
          {(signals ?? []).map((signal) => {
            const profile = signal.profiles;
            const entryPrice = Number(signal.entry_price || 0);
            const currentPrice = Number(signal.current_price || entryPrice);
            const returnPct = entryPrice > 0
              ? (signal.action === "BUY"
                ? ((currentPrice - entryPrice) / entryPrice) * 100
                : ((entryPrice - currentPrice) / entryPrice) * 100)
              : 0;
            const isFollowed = followedIds.has(signal.user_id);

            return (
              <div
                key={signal.id}
                className="grid grid-cols-12 gap-4 px-5 py-3.5 items-center hover:bg-[var(--color-bg-elevated)] transition-colors group"
              >
                {/* Trader */}
                <div className="col-span-3 flex items-center gap-2.5">
                  <Avatar src={profile?.avatar_url} alt={profile?.display_name ?? profile?.username} size="sm" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {profile?.display_name ?? profile?.username}
                      </span>
                      {profile?.is_verified && <Badge variant="verified">V</Badge>}
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">@{profile?.username}</span>
                  </div>
                </div>

                {/* Ticker */}
                <div className="col-span-1">
                  <span className="font-data font-bold text-sm text-[var(--color-text-primary)]">
                    {signal.ticker}
                  </span>
                </div>

                {/* Action */}
                <div className="col-span-1">
                  <Badge variant={signal.action === "BUY" ? "buy" : "sell"}>
                    {signal.action}
                  </Badge>
                </div>

                {/* Entry */}
                <div className="col-span-1">
                  <span className="font-data text-sm text-[var(--color-text-secondary)]">
                    ${entryPrice.toFixed(2)}
                  </span>
                </div>

                {/* Current */}
                <div className="col-span-1">
                  <span className="font-data text-sm text-[var(--color-text-primary)]">
                    ${currentPrice.toFixed(2)}
                  </span>
                </div>

                {/* Return */}
                <div className="col-span-1">
                  <span className={`font-data font-semibold text-sm ${returnPct >= 0 ? "text-[var(--color-accent-green)]" : "text-[var(--color-sell)]"}`}>
                    {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(2)}%
                  </span>
                </div>

                {/* Stop Loss */}
                <div className="col-span-1">
                  <span className="font-data text-xs text-[var(--color-text-muted)]">
                    {signal.stop_loss ? `$${Number(signal.stop_loss).toFixed(2)}` : "—"}
                  </span>
                </div>

                {/* Time */}
                <div className="col-span-1">
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {timeAgo(signal.created_at)}
                  </span>
                </div>

                {/* Copy */}
                <div className="col-span-2 flex justify-end">
                  <Button
                    size="sm"
                    variant={isFollowed ? "primary" : "secondary"}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {isFollowed ? "Copy" : "Follow to copy"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
