import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { timeAgo } from "@/lib/utils";
import { MessageSquare, Heart, Share2, ExternalLink } from "lucide-react";

const mockPosts = [
  {
    id: "1",
    user: { username: "sirjack", displayName: "Sir Jack", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop", is_verified: true },
    type: "analysis",
    ticker: "NVDA",
    title: "Why NVIDIA breaks $900 before earnings",
    content: "Data center revenue up 409% YoY. Supply constraints finally easing. Jensen said 'the next industrial revolution has begun' on the last call. I'm adding to my position on any pullback below $850.",
    likes_count: 234,
    comments_count: 56,
    created_at: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: "2",
    user: { username: "thequant", displayName: "The Quant", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop", is_verified: true },
    type: "signal",
    ticker: "TSLA",
    title: "Closing TSLA — taking profits at resistance",
    content: "Model 3 refresh not enough to justify current multiple. Cutting exposure to 5% from 15%. Will re-enter on a confirmed breakout above $255.",
    likes_count: 89,
    comments_count: 23,
    created_at: new Date(Date.now() - 2400000).toISOString(),
  },
  {
    id: "3",
    user: { username: "optionsking", displayName: "Options King", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop", is_verified: true },
    type: "idea",
    ticker: "SPY",
    title: "Fed pivot trade: SPY $540 calls for December",
    content: "CPI trending down, unemployment ticking up. Historical precedent suggests Fed cuts within 60 days. Dec $540 calls offer 4:1 reward-to-risk at current prices.",
    likes_count: 412,
    comments_count: 98,
    created_at: new Date(Date.now() - 5400000).toISOString(),
  },
];

export default async function FeedPage() {
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
        {mockPosts.map((post) => (
          <Card key={post.id} className="p-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <Avatar
                  src={post.user.avatar}
                  alt={post.user.displayName}
                  size="md"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {post.user.displayName}
                    </span>
                    {post.user.is_verified && <Badge variant="verified">V</Badge>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <span>@{post.user.username}</span>
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
                <span>{post.comments_count}</span>
              </button>
              <button className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent-green)] transition-colors">
                <Heart size={13} />
                <span>{post.likes_count}</span>
              </button>
              <button className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ml-auto">
                <ExternalLink size={13} />
                <span>Share</span>
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
