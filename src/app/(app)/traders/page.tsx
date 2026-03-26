import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatPercent, formatCompactNumber } from "@/lib/utils";

export default async function TradersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch all profiles who are marked as traders
  const { data: traders } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, is_verified")
    .eq("is_trader", true)
    .order("created_at", { ascending: false })
    .limit(50);

  // Get follower counts per trader
  const { data: followerCounts } = await supabase
    .from("follows")
    .select("leader_id")
    .eq("is_active", true);

  // Get signals count per trader
  const { data: signalCounts } = await supabase
    .from("signals")
    .select("user_id")
    .eq("is_active", true);

  const followerMap = new Map<string, number>();
  followerCounts?.forEach(f => {
    followerMap.set(f.leader_id, (followerMap.get(f.leader_id) ?? 0) + 1);
  });

  const signalMap = new Map<string, number>();
  signalCounts?.forEach(s => {
    signalMap.set(s.user_id, (signalMap.get(s.user_id) ?? 0) + 1);
  });

  // Check which traders the current user follows
  const { data: userFollows } = await supabase
    .from("follows")
    .select("leader_id")
    .eq("follower_id", user!.id)
    .eq("is_active", true);

  const followedIds = new Set(userFollows?.map(f => f.leader_id) ?? []);

  // Mock performance data (would come from real P&L tracking in production)
  const mockPerformance = traders?.map(t => ({
    ...t,
    return30d: (Math.random() * 60 - 10).toFixed(1),
    followers: followerMap.get(t.id) ?? 0,
    signals: signalMap.get(t.id) ?? 0,
    isFollowing: followedIds.has(t.id),
  })) ?? [];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl text-[var(--color-text-primary)] mb-2">
          Top Traders
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Discover and follow verified traders with proven track records
        </p>
      </div>

      {/* Search */}
      <Card className="p-4 mb-6">
        <input
          type="text"
          placeholder="Search traders by username or specialty..."
          className="w-full h-10 px-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-md text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-green)]"
        />
      </Card>

      {/* Traders grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockPerformance.map((trader) => (
          <Card key={trader.id} className="p-6" hover>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <Avatar
                  src={trader.avatar_url}
                  alt={trader.display_name ?? trader.username}
                  size="xl"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {trader.display_name ?? trader.username}
                    </span>
                    {trader.is_verified && <Badge variant="verified">Verified</Badge>}
                  </div>
                  <span className="text-sm text-[var(--color-text-muted)]">
                    @{trader.username}
                  </span>
                </div>
              </div>
            </div>

            {trader.bio && (
              <p className="text-sm text-[var(--color-text-secondary)] mb-4 line-clamp-2">
                {trader.bio}
              </p>
            )}

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <span className="text-xs text-[var(--color-text-muted)] block mb-1">
                  30D Return
                </span>
                <span
                  className={`font-data font-semibold ${
                    parseFloat(trader.return30d) >= 0
                      ? "text-[var(--color-accent-green)]"
                      : "text-[var(--color-sell)]"
                  }`}
                >
                  {formatPercent(parseFloat(trader.return30d))}
                </span>
              </div>
              <div>
                <span className="text-xs text-[var(--color-text-muted)] block mb-1">
                  Followers
                </span>
                <span className="font-data font-semibold text-[var(--color-text-primary)]">
                  {formatCompactNumber(trader.followers)}
                </span>
              </div>
              <div>
                <span className="text-xs text-[var(--color-text-muted)] block mb-1">
                  Signals
                </span>
                <span className="font-data font-semibold text-[var(--color-text-primary)]">
                  {trader.signals}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant={trader.isFollowing ? "secondary" : "primary"}
                className="flex-1"
                size="sm"
              >
                {trader.isFollowing ? "Following" : "Follow"}
              </Button>
              <Button variant="secondary" size="sm">
                <a href={`/traders/${trader.username}`}>View Profile</a>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
