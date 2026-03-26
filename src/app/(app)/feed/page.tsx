import { createClient } from "@/lib/supabase/server";
import { FeedCard } from "@/components/feed/FeedCard";
import { FeedRealtimeProvider } from "@/components/feed/FeedRealtimeProvider";

export default async function FeedPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: feedPosts }, { data: likedPosts }] = await Promise.all([
    supabase
      .from("feed_posts")
      .select("*, profiles:user_id(id, username, display_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(30),
    user
      ? supabase
          .from("likes")
          .select("post_id")
          .eq("user_id", user.id)
      : Promise.resolve({ data: [] }),
  ]);

  const likedPostIds = new Set(likedPosts?.map(l => l.post_id) ?? []);

  return (
    <div className="max-w-2xl">
      <div className="mb-5">
        <h1 className="font-display text-2xl text-[var(--color-text-primary)] tracking-tight">
          Feed
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          Due diligence and signals from traders you follow
        </p>
      </div>

      <FeedRealtimeProvider>
        <div className="space-y-4">
          {(feedPosts ?? []).map((post) => (
            <FeedCard
              key={post.id}
              post={post}
              initialLiked={likedPostIds.has(post.id)}
              currentUserId={user?.id ?? null}
            />
          ))}
        </div>
      </FeedRealtimeProvider>
    </div>
  );
}
