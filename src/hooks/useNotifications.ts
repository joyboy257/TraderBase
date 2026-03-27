"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
}

export function useNotifications(userId: string | null): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Fetch initial notifications and subscribe to realtime inserts
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    // Fetch existing notifications ordered by created_at desc
    async function fetchNotifications() {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, type, title, body, read, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("[useNotifications] Failed to fetch notifications:", error);
        return;
      }
      setNotifications(data ?? []);
    }

    fetchNotifications();

    // Subscribe to realtime inserts on the user's notification channel
    const channel: RealtimeChannel = supabase.channel(`notifications:${userId}`);

    channel.on("broadcast", { event: "notification_inserted" }, (payload) => {
      const rawNotification = payload.payload.notification;
      if (!rawNotification || typeof rawNotification !== 'object' || !rawNotification.id || !rawNotification.user_id) {
        console.warn('Invalid notification payload received');
        return;
      }
      const notification = rawNotification as Notification;
      if (notification.user_id === userId) {
        setNotifications((prev) => [notification, ...prev]);
      }
    });

    channel.subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount };
}
