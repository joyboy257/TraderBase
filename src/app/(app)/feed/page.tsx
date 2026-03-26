import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { timeAgo } from "@/lib/utils";

export default async function FeedPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // Fetch feed posts with user data
  const { data: posts } = await supabase
    .from("feed_posts")
    .select("*, profiles:user_id(username, display_name, avatar_url, is_verified)")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl text-[var(--color-text-primary)] mb-2">
          Feed
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Due diligence, charts, and signals from traders you follow
        </p>
      </div>

      {/* Feed posts */}
      <div className="space-y-4">
        {posts && posts.length > 0 ? (
          posts.map((post) => (
            <Card key={post.id} className="p-6" hover>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={post.profiles?.avatar_url}
                    alt={post.profiles?.display_name || "Trader"}
                    size="md"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {post.profiles?.display_name}
                      </span>
                      {post.profiles?.is_verified && (
                        <Badge variant="verified">Verified</Badge>
                      )}
                    </div>
                    <span className="text-sm text-[var(--color-text-muted)]">
                      @{post.profiles?.username} · {timeAgo(post.created_at)}
                    </span>
                  </div>
                </div>
                {post.ticker && (
                  <Badge variant={post.type === "signal" ? "buy" : "neutral"}>
                    {post.ticker}
                  </Badge>
                )}
              </div>

              {/* Title */}
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">
                {post.title}
              </h3>

              {/* Content */}
              {post.content && (
                <p className="text-[var(--color-text-secondary)] mb-4 leading-relaxed">
                  {post.content}
                </p>
              )}

              {/* Type badge */}
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-4">
                <span className="uppercase tracking-wider">{post.type}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-6 pt-4 border-t border-[var(--color-border-subtle)]">
                <button className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                  <span>💬</span>
                  <span>{post.comments_count || 0}</span>
                </button>
                <button className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent-green)] transition-colors">
                  <span>♡</span>
                  <span>{post.likes_count || 0}</span>
                </button>
                <button className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                  <span>↗</span>
                  <span>Share</span>
                </button>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-12 text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="font-display text-xl text-[var(--color-text-primary)] mb-2">
              No posts yet
            </h3>
            <p className="text-[var(--color-text-secondary)]">
              Follow some traders to see their posts in your feed.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
