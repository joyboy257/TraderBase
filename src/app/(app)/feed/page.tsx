import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { timeAgo } from "@/lib/utils";
import { MessageSquare, Heart, Share2, ExternalLink } from "lucide-react";

export default async function FeedPage() {
  const supabase = await createClient();

  const { data: feedPosts } = await supabase
    .from("feed_posts")
    .select("*, profiles:user_id(id, username, display_name, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(30);

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

      <div className="space-y-4">
        {(feedPosts ?? []).map((post) => {
          const profile = post.profiles;
          return (
            <Card key={post.id} className="p-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <Avatar
                    src={profile?.avatar_url}
                    alt={profile?.display_name ?? profile?.username}
                    size="md"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {profile?.display_name ?? profile?.username}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                      <span>@{profile?.username}</span>
                      <span>·</span>
                      <span>{timeAgo(post.created_at)}</span>
                    </div>
                  </div>
                </div>
                {post.ticker && (
                  <Badge variant={post.type === "signal" ? "buy" : "neutral"} className="flex-shrink-0">
                    {post.ticker}
                  </Badge>
                )}
              </div>

              {/* Content */}
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-2 leading-snug">
                {post.title}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-3">
                {post.content}
              </p>

              {/* Type tag */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] px-2 py-0.5 rounded">
                  {post.type}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-5 pt-3 border-t border-[var(--color-border-subtle)]">
                <button className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
                  <MessageSquare size={13} />
                  <span>{post.comments_count ?? 0}</span>
                </button>
                <button className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent-green)] transition-colors">
                  <Heart size={13} />
                  <span>{post.likes_count ?? 0}</span>
                </button>
                <button className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ml-auto">
                  <ExternalLink size={13} />
                  <span>Share</span>
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
