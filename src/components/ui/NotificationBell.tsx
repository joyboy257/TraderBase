"use client";

import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import { timeAgo } from "@/lib/utils";

interface NotificationBellProps {
  userId: string | null;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const { notifications, unreadCount } = useNotifications(userId);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "relative p-2 rounded-lg transition-colors",
          "hover:bg-[var(--color-bg-elevated)]",
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-purple)]"
        )}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-[var(--color-text-secondary)]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-[var(--color-sell)] text-white text-[10px] font-bold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] shadow-lg z-50">
          <div className="px-4 py-3 border-b border-[var(--color-border-default)]">
            <h3 className="font-semibold text-[var(--color-text-primary)]">Notifications</h3>
          </div>

          <div className="py-1">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-[var(--color-text-secondary)] text-sm">
                No notifications
              </div>
            ) : (
              <ul>
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={cn(
                      "px-4 py-3 border-b border-[var(--color-border-subtle)] last:border-b-0",
                      "hover:bg-[var(--color-bg-secondary)] transition-colors",
                      !notification.read && "bg-[var(--color-bg-secondary)]"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                          {notification.title}
                        </p>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">
                          {notification.body}
                        </p>
                        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                          {timeAgo(notification.created_at)}
                        </p>
                      </div>
                      {!notification.read && (
                        <span className="w-2 h-2 rounded-full bg-[var(--color-accent-purple)] flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
