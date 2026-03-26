"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ExternalLink } from "lucide-react";
import { revalidatePath } from "next/cache";
import Link from "next/link";

interface FollowButtonGridProps {
  leaderId: string;
  leaderUsername: string;
  isFollowing: boolean;
}

export function FollowButton({ leaderId, leaderUsername, isFollowing: initialIsFollowing }: FollowButtonGridProps) {
  const [isPending, startTransition] = useTransition();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);

  async function handleFollow() {
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
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Button
        variant={isFollowing ? "secondary" : "primary"}
        size="sm"
        onClick={handleFollow}
        disabled={isPending}
        className="flex-1"
      >
        {isPending ? "..." : isFollowing ? "Following" : "Follow"}
      </Button>
      <Link href={`/traders/${leaderUsername}`}>
        <Button variant="ghost" size="sm" className="px-2">
          <ExternalLink size={14} />
        </Button>
      </Link>
    </div>
  );
}
