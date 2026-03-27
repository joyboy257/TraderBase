"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { formatPercent, timeAgo } from "@/lib/utils";

const sampleSignals = [
  {
    id: "1",
    user: { username: "sirjack", displayName: "Sir Jack", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop" },
    ticker: "NVDA",
    action: "BUY",
    entryPrice: 875.5,
    returnPct: 3.2,
    isVerified: true,
    time: new Date(Date.now() - 120000),
  },
  {
    id: "2",
    user: { username: "thequant", displayName: "The Quant", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop" },
    ticker: "TSLA",
    action: "SELL",
    entryPrice: 242.8,
    returnPct: -1.5,
    isVerified: true,
    time: new Date(Date.now() - 300000),
  },
  {
    id: "3",
    user: { username: "optionsking", displayName: "Options King", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop" },
    ticker: "SPY",
    action: "BUY",
    entryPrice: 512.3,
    returnPct: 0.8,
    isVerified: true,
    time: new Date(Date.now() - 600000),
  },
  {
    id: "4",
    user: { username: "diamondhands", displayName: "Diamond Hands", avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&h=100&fit=crop" },
    ticker: "AAPL",
    action: "BUY",
    entryPrice: 185.2,
    returnPct: 1.4,
    isVerified: true,
    time: new Date(Date.now() - 900000),
  },
  {
    id: "5",
    user: { username: "valuehunter", displayName: "Value Hunter", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop" },
    ticker: "META",
    action: "BUY",
    entryPrice: 498.7,
    returnPct: 2.1,
    isVerified: false,
    time: new Date(Date.now() - 1200000),
  },
];

export function LiveActivity() {
  const [signals, setSignals] = useState(sampleSignals);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % signals.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [signals.length]);

  const currentSignal = signals[currentIndex];

  return (
    <section
      id="activity"
      className="py-24 px-4 bg-[var(--color-bg-base)] relative overflow-hidden"
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(111,43,255,0.3) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-semibold tracking-widest uppercase text-[var(--color-accent-green)] mb-4 block">
            Live Activity
          </span>
          <h2 className="font-display text-4xl md:text-5xl text-[var(--color-text-primary)] mb-4">
            See real trades in real-time
          </h2>
          <p className="text-lg text-[var(--color-text-secondary)]">
            No delay. No editing. Every signal linked to a verified brokerage.
          </p>
        </div>

        {/* Live signal card */}
        <div className="relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] text-xs text-[var(--color-text-secondary)]">
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent-green)] animate-pulse" />
              LIVE
            </span>
          </div>

          <div className="p-8 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-2xl">
            {currentSignal && (
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="flex items-center gap-4 flex-1">
                  <Avatar
                    src={currentSignal.user.avatar}
                    alt={currentSignal.user.displayName}
                    size="lg"
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[var(--color-text-primary)]">
                        {currentSignal.user.displayName}
                      </span>
                      {currentSignal.isVerified && (
                        <Badge variant="verified">Verified</Badge>
                      )}
                    </div>
                    <span className="text-sm text-[var(--color-text-muted)]">
                      @{currentSignal.user.username}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <Badge
                      variant={currentSignal.action === "BUY" ? "buy" : "sell"}
                    >
                      {currentSignal.action}
                    </Badge>
                    <span className="font-data font-bold text-2xl text-[var(--color-text-primary)] ml-3">
                      {currentSignal.ticker}
                    </span>
                  </div>

                  <div className="text-right">
                    <div className="font-data font-semibold text-lg text-[var(--color-text-primary)]">
                      ${currentSignal.entryPrice.toFixed(2)}
                    </div>
                    <div
                      className={`font-data text-sm ${
                        currentSignal.returnPct >= 0
                          ? "text-[var(--color-accent-green)]"
                          : "text-[var(--color-sell)]"
                      }`}
                    >
                      {formatPercent(currentSignal.returnPct)}
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className="text-xs text-[var(--color-text-muted)] block"
                      suppressHydrationWarning
                    >
                      {timeAgo(currentSignal.time)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Signal dots */}
        <div className="flex justify-center gap-2 mt-6">
          {signals.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? "w-6 bg-[var(--color-accent-green)]"
                  : "bg-[var(--color-bg-elevated)] hover:bg-[var(--color-text-muted)]"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
