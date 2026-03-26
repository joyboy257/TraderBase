"use client";

import { useState, useEffect } from "react";
import { Search, Bell, ChevronDown, LogOut, User, Settings } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface TopBarProps {
  profile: {
    display_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  } | null;
}

export function TopBar({ profile }: TopBarProps) {
  const [time, setTime] = useState<string>("");
  const [marketOpen, setMarketOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const et = now.toLocaleString("en-US", { timeZone: "America/New_York" });
      const etDate = new Date(et);
      const hours = etDate.getHours();
      const minutes = etDate.getMinutes();
      const day = etDate.getDay();
      const isWeekday = day >= 1 && day <= 5;
      const isDuringHours = hours >= 9 && (hours < 16 || (hours === 16 && minutes === 0));
      setMarketOpen(isWeekday && isDuringHours);
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-subtle)] flex items-center px-4 gap-4">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2.5 mr-4">
        <div className="w-8 h-8 rounded-md bg-[var(--color-accent-green)] flex items-center justify-center flex-shrink-0">
          <span className="font-data font-bold text-[var(--color-text-inverse)] text-[10px] tracking-tight">
            TB
          </span>
        </div>
        <span className="font-display text-[15px] text-[var(--color-text-primary)] tracking-tight">
          TraderBase
        </span>
      </Link>

      {/* Market status — center */}
      <div className="flex-1 flex justify-center">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${marketOpen ? "bg-[var(--color-accent-green)] animate-pulse" : "bg-[var(--color-text-muted)]"}`}
            />
            <span className="text-xs font-data text-[var(--color-text-secondary)]">
              {marketOpen ? "MARKET OPEN" : "MARKET CLOSED"}
            </span>
          </div>
          <span className="text-[var(--color-border-default)]">·</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-data text-[var(--color-text-muted)]">ET</span>
            <span className="text-xs font-data text-[var(--color-text-secondary)]">{time}</span>
          </div>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Search */}
        <button className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors">
          <Search size={16} />
        </button>

        {/* Notifications */}
        <button className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors relative">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--color-accent-green)]" />
        </button>

        {/* User menu */}
        <div className="relative ml-2">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-md hover:bg-[var(--color-bg-elevated)] transition-colors"
          >
            <Avatar
              src={profile?.avatar_url}
              alt={profile?.display_name ?? "User"}
              size="sm"
            />
            <ChevronDown size={12} className="text-[var(--color-text-muted)]" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-[var(--color-border-subtle)]">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {profile?.display_name ?? "Trader"}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">
                    @{profile?.username ?? "user"}
                  </p>
                </div>
                <nav className="py-1">
                  <Link
                    href="/settings"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface)] transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    <User size={14} />
                    Profile
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface)] transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Settings size={14} />
                    Settings
                  </Link>
                </nav>
                <div className="border-t border-[var(--color-border-subtle)] py-1">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[var(--color-sell)] hover:bg-[var(--color-bg-surface)] transition-colors"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
