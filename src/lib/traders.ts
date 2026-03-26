import { createServerClient } from "@supabase/ssr";

export interface TopTrader {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  followers_count: number;
}

/**
 * Get top traders ordered by follower count.
 * Used by BrowseTradersStep (onboarding) and the /traders page.
 */
export async function getTopTraders(limit = 10): Promise<TopTrader[]> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Get traders ordered by follower count (count join via subquery)
  const { data: traders, error } = await supabase
    .from("profiles")
    .select(`
      id,
      username,
      display_name,
      avatar_url,
      is_trader,
      is_verified
    `)
    .eq("is_trader", true)
    .limit(limit);

  if (error || !traders) return [];

  const traderIds = traders.map((t) => t.id);
  if (traderIds.length === 0) return [];

  // Count followers per trader
  const { data: followerCounts } = await supabase
    .from("follows")
    .select("leader_id")
    .in("leader_id", traderIds)
    .eq("is_active", true);

  const countMap: Record<string, number> = {};
  followerCounts?.forEach((f) => {
    countMap[f.leader_id] = (countMap[f.leader_id] ?? 0) + 1;
  });

  return traders
    .map((t) => ({
      id: t.id,
      username: t.username,
      display_name: t.display_name,
      avatar_url: t.avatar_url,
      is_verified: t.is_verified ?? false,
      followers_count: countMap[t.id] ?? 0,
    }))
    .sort((a, b) => b.followers_count - a.followers_count);
}
