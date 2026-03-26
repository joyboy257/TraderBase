"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { revalidatePath } from "next/cache";

interface FollowButtonProps {
  leaderId: string;
  leaderUsername: string;
  isFollowing: boolean;
  followerId: string;
}

export function FollowButton({ leaderId, leaderUsername, isFollowing: initialIsFollowing, followerId }: FollowButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [error, setError] = useState<string | null>(null);

  async function handleFollow() {
    if (!followerId) {
      setError("Sign in to follow");
      return;
    }
    startTransition(async () => {
      const method = isFollowing ? "DELETE" : "POST";
      const res = await fetch("/api/follow", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leader_id: leaderId }),
      });
      if (res.ok) {
        setIsFollowing(!isFollowing);
        revalidatePath("/traders");
        revalidatePath(`/traders/${leaderUsername}`);
      }
    });
  }

  return (
    <Button
      variant={isFollowing ? "secondary" : "primary"}
      size="sm"
      onClick={handleFollow}
      disabled={isPending}
      className="flex-1"
    >
      {isPending ? "..." : isFollowing ? "Following" : "Follow"}
    </Button>
    {error && <span className="text-xs text-[var(--color-sell)]">{error}</span>}
  );
}
