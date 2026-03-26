"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Zap,
  MessageCircle,
  Briefcase,
  Users,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePolygonPrices } from "@/hooks/usePolygonPrices";

const navSections = [
  {
    label: "OVERVIEW",
    items: [
      { href: "/dashboard", Icon: LayoutDashboard, label: "Dashboard" },
    ],
  },
  {
    label: "SOCIAL",
    items: [
      { href: "/feed", Icon: TrendingUp, label: "Feed" },
      { href: "/traders", Icon: Users, label: "Traders" },
    ],
  },
  {
    label: "MARKETS",
    items: [
      { href: "/signals", Icon: Zap, label: "Signals" },
      { href: "/portfolio", Icon: Briefcase, label: "Portfolio" },
      { href: "/chat", Icon: MessageCircle, label: "Chat" },
    ],
  },
  {
    label: "ACCOUNT",
    items: [
      { href: "/settings", Icon: Settings, label: "Settings" },
    ],
  },
];

const WATCHLIST_TICKERS = ["AAPL", "NVDA", "TSLA", "META", "SPY"];

export function Sidebar() {
  const pathname = usePathname();
  const { prices, isConnected } = usePolygonPrices(WATCHLIST_TICKERS);

  return (
    <aside className="fixed left-0 top-14 bottom-0 w-56 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border-subtle)] flex flex-col z-40 overflow-hidden">
      <nav className="flex-1 overflow-y-auto py-4">
        {navSections.map((section) => (
          <div key={section.label} className="mb-4">
            <p className="px-4 mb-1 text-[10px] font-semibold tracking-widest text-[var(--color-text-muted)] uppercase">
              {section.label}
            </p>
            {section.items.map(({ href, Icon, label }) => {
              const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 mx-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 relative",
                    isActive
                      ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface)]"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[var(--color-accent-green)] rounded-r" />
                  )}
                  <Icon size={15} className={isActive ? "text-[var(--color-accent-green)]" : ""} />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Watchlist */}
      <div className="border-t border-[var(--color-border-subtle)] p-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-[10px] font-semibold tracking-widest text-[var(--color-text-muted)] uppercase">
            Watchlist
          </p>
          <span className="flex items-center gap-1">
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                isConnected ? "bg-[var(--color-accent-green)]" : "bg-[var(--color-text-muted)]"
              )}
            />
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {isConnected ? "Live" : "Offline"}
            </span>
          </span>
        </div>
        <div className="space-y-0.5">
          {WATCHLIST_TICKERS.map((ticker) => {
            const data = prices.get(ticker);
            const price = data?.price ?? 0;
            const changePercent = data?.changePercent ?? 0;
            const displayPrice = price > 0 ? `$${price.toFixed(2)}` : "--";
            const displayChange = changePercent !== 0
              ? `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`
              : "--";
            return (
              <Link
                key={ticker}
                href={`/chat/${ticker}`}
                className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-[var(--color-bg-elevated)] transition-colors group"
              >
                <span className="font-data text-xs font-semibold text-[var(--color-text-primary)]">
                  {ticker}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-data text-xs text-[var(--color-text-secondary)]">
                    {displayPrice}
                  </span>
                  <span
                    className={cn(
                      "font-data text-[10px]",
                      changePercent > 0 ? "text-[var(--color-accent-green)]" : changePercent < 0 ? "text-[var(--color-sell)]" : "text-[var(--color-text-muted)]"
                    )}
                  >
                    {displayChange}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
