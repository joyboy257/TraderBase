"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CopySignalButton } from "@/components/social/CopySignalButton";
import { timeAgo } from "@/lib/utils";

interface Signal {
  id: string;
  ticker: string;
  action: "BUY" | "SELL";
  entry_price: number | null;
  current_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  rationale: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  user_id: string;
  profiles: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  } | null;
}

interface SignalsTableProps {
  initialSignals: Signal[];
  followedIds: Set<string>;
  userId: string;
}

export function SignalsTable({ initialSignals, followedIds, userId }: SignalsTableProps) {
  const [signals, setSignals] = useState<Signal[]>(initialSignals);
  const seenIds = useRef<Set<string>>(new Set(initialSignals.map(s => s.id)));

  useEffect(() => {
    const supabase = createClient();
    const channel: RealtimeChannel = supabase.channel("signals-realtime");

    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "signals" }, (payload) => {
      const newSignal = payload.new as Signal;
      if (newSignal.is_active && !seenIds.current.has(newSignal.id)) {
        seenIds.current.add(newSignal.id);
        setSignals(prev => {
          const next = [newSignal, ...prev];
          return next.slice(0, 50);
        });
      }
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
  }, []);

  return (
    <Card className="overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
        {[
          { label: "Trader", col: "col-span-3" },
          { label: "Ticker", col: "col-span-1" },
          { label: "Action", col: "col-span-1" },
          { label: "Entry", col: "col-span-1" },
          { label: "Current", col: "col-span-1" },
          { label: "Return", col: "col-span-1" },
          { label: "Stop Loss", col: "col-span-1" },
          { label: "Time", col: "col-span-1" },
          { label: "", col: "col-span-2" },
        ].map(({ label, col }) => (
          <div key={label} className={`${col} text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]`}>
            {label}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-[var(--color-border-subtle)]">
        {signals.map((signal) => {
          const profile = signal.profiles;
          const entryPrice = Number(signal.entry_price || 0);
          const currentPrice = Number(signal.current_price || entryPrice);
          const returnPct = entryPrice > 0
            ? (signal.action === "BUY"
              ? ((currentPrice - entryPrice) / entryPrice) * 100
              : ((entryPrice - currentPrice) / entryPrice) * 100)
            : 0;

          return (
            <div
              key={signal.id}
              className="grid grid-cols-12 gap-4 px-5 py-3.5 items-center hover:bg-[var(--color-bg-elevated)] transition-colors group"
            >
              {/* Trader */}
              <div className="col-span-3 flex items-center gap-2.5">
                <Avatar src={profile?.avatar_url} alt={profile?.display_name ?? profile?.username ?? "User"} size="sm" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {profile?.display_name ?? profile?.username}
                    </span>
                    {profile?.is_verified && <Badge variant="verified">V</Badge>}
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">@{profile?.username}</span>
                </div>
              </div>

              {/* Ticker */}
              <div className="col-span-1">
                <span className="font-data font-bold text-sm text-[var(--color-text-primary)]">
                  {signal.ticker}
                </span>
              </div>

              {/* Action */}
              <div className="col-span-1">
                <Badge variant={signal.action === "BUY" ? "buy" : "sell"}>
                  {signal.action}
                </Badge>
              </div>

              {/* Entry */}
              <div className="col-span-1">
                <span className="font-data text-sm text-[var(--color-text-secondary)]">
                  ${entryPrice.toFixed(2)}
                </span>
              </div>

              {/* Current */}
              <div className="col-span-1">
                <span className="font-data text-sm text-[var(--color-text-primary)]">
                  ${currentPrice.toFixed(2)}
                </span>
              </div>

              {/* Return */}
              <div className="col-span-1">
                <span className={`font-data font-semibold text-sm ${returnPct >= 0 ? "text-[var(--color-accent-green)]" : "text-[var(--color-sell)]"}`}>
                  {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(2)}%
                </span>
              </div>

              {/* Stop Loss */}
              <div className="col-span-1">
                <span className="font-data text-xs text-[var(--color-text-muted)]">
                  {signal.stop_loss ? `$${Number(signal.stop_loss).toFixed(2)}` : "—"}
                </span>
              </div>

              {/* Time */}
              <div className="col-span-1">
                <span className="text-xs text-[var(--color-text-muted)]">
                  {timeAgo(signal.created_at)}
                </span>
              </div>

              {/* Copy */}
              <div className="col-span-2 flex justify-end">
                <CopySignalButton
                  signalId={signal.id}
                  ticker={signal.ticker}
                  action={signal.action}
                  followerId={userId}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
