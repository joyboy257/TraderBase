import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SignalsTable } from "@/components/feed/SignalsTable";

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
        <Button size="sm" onClick={() => alert("Signal creation coming soon — enter your trade in your linked brokerage and it will appear here")}>
          Create Signal
        </Button>
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
      <SignalsTable
        initialSignals={signals ?? []}
        followedIds={followedIds}
        userId={userId}
      />
    </div>
  );
}
