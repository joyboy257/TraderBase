"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface FeedRealtimeState {
  seenPostIds: Set<string>;
  // Listener callbacks keyed by postId
  likeListeners: Map<string, Set<(delta: number) => void>>;
  commentListeners: Map<string, Set<(delta: number) => void>>;
}

interface FeedRealtimeContextValue {
  seenPostIds: Set<string>;
  registerLikeListener: (postId: string, cb: (delta: number) => void) => () => void;
  registerCommentListener: (postId: string, cb: (delta: number) => void) => () => void;
}

const FeedRealtimeContext = createContext<FeedRealtimeContextValue>({
  seenPostIds: new Set(),
  registerLikeListener: () => () => {},
  registerCommentListener: () => () => {},
});

export function useFeedRealtime() {
  return useContext(FeedRealtimeContext);
}

export function FeedRealtimeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FeedRealtimeState>({
    seenPostIds: new Set(),
    likeListeners: new Map(),
    commentListeners: new Map(),
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const registerLikeListener = useCallback((postId: string, cb: (delta: number) => void) => {
    setState(prev => {
      const listeners = new Map(prev.likeListeners);
      if (!listeners.has(postId)) listeners.set(postId, new Set());
      listeners.get(postId)!.add(cb);
      return { ...prev, likeListeners: listeners };
    });
    return () => {
      setState(prev => {
        const listeners = new Map(prev.likeListeners);
        listeners.get(postId)?.delete(cb);
        return { ...prev, likeListeners: listeners };
      });
    };
  }, []);

  const registerCommentListener = useCallback((postId: string, cb: (delta: number) => void) => {
    setState(prev => {
      const listeners = new Map(prev.commentListeners);
      if (!listeners.has(postId)) listeners.set(postId, new Set());
      listeners.get(postId)!.add(cb);
      return { ...prev, commentListeners: listeners };
    });
    return () => {
      setState(prev => {
        const listeners = new Map(prev.commentListeners);
        listeners.get(postId)?.delete(cb);
        return { ...prev, commentListeners: listeners };
      });
    };
  }, []);

  const markSeen = useCallback((postId: string) => {
    setState(prev => {
      if (prev.seenPostIds.has(postId)) return prev;
      const next = new Set(prev.seenPostIds);
      next.add(postId);
      return { ...prev, seenPostIds: next };
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel: RealtimeChannel = supabase.channel("feed-realtime");

    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "likes" }, (payload) => {
      const postId = payload.new.post_id as string;
      const current = stateRef.current;
      current.likeListeners.get(postId)?.forEach(cb => cb(1));
      markSeen(postId);
    });

    channel.on("postgres_changes", { event: "DELETE", schema: "public", table: "likes" }, (payload) => {
      const postId = payload.old?.post_id as string | undefined;
      if (postId) stateRef.current.likeListeners.get(postId)?.forEach(cb => cb(-1));
    });

    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "comments" }, (payload) => {
      const postId = payload.new.post_id as string;
      const current = stateRef.current;
      current.commentListeners.get(postId)?.forEach(cb => cb(1));
      markSeen(postId);
    });

    channel.on("postgres_changes", { event: "DELETE", schema: "public", table: "comments" }, (payload) => {
      const postId = payload.old?.post_id as string | undefined;
      if (postId) stateRef.current.commentListeners.get(postId)?.forEach(cb => cb(-1));
    });

    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "feed_posts" }, (payload) => {
      markSeen(payload.new.id as string);
    });

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        channel.unsubscribe();
      } else {
        channel.subscribe();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    channel.subscribe();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      channel.unsubscribe();
    };
  }, [markSeen]);

  return (
    <FeedRealtimeContext.Provider value={{ seenPostIds: state.seenPostIds, registerLikeListener, registerCommentListener }}>
      {children}
    </FeedRealtimeContext.Provider>
  );
}
