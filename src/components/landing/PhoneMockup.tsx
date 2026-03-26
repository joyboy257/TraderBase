"use client";

import { Signal, Battery, BarChart3, TrendingUp, MessageCircle, User } from "lucide-react";

export function PhoneMockup() {
  const navIcons = [
    { Icon: BarChart3, label: "Signals" },
    { Icon: TrendingUp, label: "Feed" },
    { Icon: MessageCircle, label: "Chat" },
    { Icon: User, label: "Profile" },
  ];

  return (
    <div className="relative">
      {/* Phone frame */}
      <div
        className="relative mx-auto bg-[var(--color-bg-elevated)] rounded-[3rem] p-3 shadow-2xl"
        style={{
          boxShadow:
            "0 25px 50px -12px rgba(0,0,0,0.8), inset 0 0 0 2px rgba(255,255,255,0.1)",
        }}
      >
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[var(--color-bg-base)] rounded-b-2xl z-20" />

        {/* Screen */}
        <div
          className="w-72 h-[580px] bg-[var(--color-bg-base)] rounded-[2.5rem] overflow-hidden relative"
          style={{ boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)" }}
        >
          {/* Status bar */}
          <div className="h-12 px-6 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span className="font-data">9:41</span>
            <div className="flex items-center gap-1.5">
              <Signal size={12} />
              <Battery size={12} />
            </div>
          </div>

          {/* App content - Feed preview */}
          <div className="px-4 pb-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="font-display text-lg text-[var(--color-text-primary)]">
                Feed
              </span>
              <div className="w-8 h-8 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center text-xs font-semibold text-[var(--color-accent-green)]">
                SJ
              </div>
            </div>

            {/* Signal cards preview */}
            <div className="space-y-3">
              {/* Card 1 */}
              <div className="p-3 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-bg-elevated)]" />
                  <div>
                    <div className="h-2 w-16 bg-[var(--color-bg-elevated)] rounded" />
                    <div className="h-1.5 w-12 bg-[var(--color-bg-elevated)] rounded mt-1" />
                  </div>
                  <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">2m</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[rgba(50,255,72,0.15)] text-[var(--color-accent-green)]">
                    BUY
                  </span>
                  <span className="font-data font-bold text-sm text-[var(--color-text-primary)]">
                    NVDA
                  </span>
                  <span className="font-data text-[10px] text-[var(--color-text-secondary)]">
                    $875.50
                  </span>
                </div>
                <div className="h-12 bg-[var(--color-bg-tertiary)] rounded mt-2" />
              </div>

              {/* Card 2 */}
              <div className="p-3 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-bg-elevated)]" />
                  <div>
                    <div className="h-2 w-14 bg-[var(--color-bg-elevated)] rounded" />
                    <div className="h-1.5 w-10 bg-[var(--color-bg-elevated)] rounded mt-1" />
                  </div>
                  <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">5m</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[rgba(255,71,87,0.15)] text-[var(--color-sell)]">
                    SELL
                  </span>
                  <span className="font-data font-bold text-sm text-[var(--color-text-primary)]">
                    TSLA
                  </span>
                  <span className="font-data text-[10px] text-[var(--color-text-secondary)]">
                    $242.80
                  </span>
                </div>
                <div className="h-12 bg-[var(--color-bg-tertiary)] rounded mt-2" />
              </div>

              {/* Card 3 */}
              <div className="p-3 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-bg-elevated)]" />
                  <div>
                    <div className="h-2 w-18 bg-[var(--color-bg-elevated)] rounded" />
                    <div className="h-1.5 w-14 bg-[var(--color-bg-elevated)] rounded mt-1" />
                  </div>
                  <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">8m</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[rgba(50,255,72,0.15)] text-[var(--color-accent-green)]">
                    BUY
                  </span>
                  <span className="font-data font-bold text-sm text-[var(--color-text-primary)]">
                    AAPL
                  </span>
                  <span className="font-data text-[10px] text-[var(--color-text-secondary)]">
                    $185.20
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom nav */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-[var(--color-bg-surface)] border-t border-[var(--color-border-subtle)] flex items-center justify-around px-6">
            {navIcons.map(({ Icon, label }, i) => (
              <div
                key={label}
                className={`w-8 h-8 flex items-center justify-center ${
                  i === 0 ? "text-[var(--color-accent-green)]" : "text-[var(--color-text-muted)]"
                }`}
              >
                <Icon size={18} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
