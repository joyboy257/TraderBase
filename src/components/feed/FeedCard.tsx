"use client";

import { useState, useTransition, useEffect } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { MessageSquare, Heart, ExternalLink } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { useFeedRealtime } from "./FeedRealtimeProvider";

interface FeedCardProps {
  post: {
    id: string;
    title: string;
    content: string | null;
    type: string;
    ticker: string | null;
    created_at: string;
    likes_count: number;
    comments_count: number;
    profiles: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  };
  initialLiked?: boolean;
  currentUserId?: string | null;
}

export function FeedCard({ post, initialLiked = false, currentUserId }: FeedCardProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(post.likes_count ?? 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count ?? 0);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const { registerLikeListener, registerCommentListener } = useFeedRealtime();

  const profile = post.profiles;

  // Register with realtime provider for count updates
  useEffect(() => {
    const unsubLike = registerLikeListener(post.id, (delta) => {
      setLikesCount(prev => Math.max(0, prev + delta));
    });
    const unsubComment = registerCommentListener(post.id, (delta) => {
      setCommentsCount(prev => Math.max(0, prev + delta));
    });
    return () => {
      unsubLike();
      unsubComment();
    };
  }, [post.id, registerLikeListener, registerCommentListener]);

  function handleToggleLike() {
    if (!currentUserId) {
      setToast("Sign in to like posts");
      return;
    }
    const prevLiked = liked;
    const prevCount = likesCount;
    setLiked(!liked);
    setLikesCount(liked ? likesCount - 1 : likesCount + 1);

    startTransition(async () => {
      const { toggleLike } = await import("@/app/actions/feed");
      const result = await toggleLike(post.id);
      if (!result.success) {
        setLiked(prevLiked);
        setLikesCount(prevCount);
        setToast(result.error ?? "Failed to like");
      }
    });
  }

  return (
    <>
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] px-4 py-2 rounded-lg shadow-lg text-sm text-[var(--color-text-primary)]">
          {toast}
        </div>
      )}
      <Card className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <Avatar
              src={profile?.avatar_url}
              alt={profile?.display_name ?? profile?.username ?? "User"}
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
            <span>{commentsCount}</span>
          </button>
          <button
            onClick={handleToggleLike}
            disabled={isPending}
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              liked
                ? "text-[var(--color-accent-green)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-accent-green)]"
            }`}
          >
            <Heart size={13} fill={liked ? "currentColor" : "none"} />
            <span>{likesCount}</span>
          </button>
          <button className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ml-auto">
            <ExternalLink size={13} />
            <span>Share</span>
          </button>
        </div>
      </Card>
    </>
  );
}
