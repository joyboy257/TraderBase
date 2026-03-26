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

// Mock watchlist data — in production this comes from Polygon.io
const watchlist = [
  { ticker: "AAPL", price: 185.32, change: 1.24 },
  { ticker: "NVDA", price: 875.50, change: 3.21 },
  { ticker: "TSLA", price: 242.80, change: -1.55 },
  { ticker: "META", price: 498.70, change: 2.10 },
  { ticker: "SPY", price: 521.45, change: 0.33 },
];

export function Sidebar() {
  const pathname = usePathname();

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
        <p className="text-[10px] font-semibold tracking-widest text-[var(--color-text-muted)] uppercase mb-2 px-1">
          Watchlist
        </p>
        <div className="space-y-0.5">
          {watchlist.map(({ ticker, price, change }) => (
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
                  ${price.toFixed(2)}
                </span>
                <span
                  className={cn(
                    "font-data text-[10px]",
                    change >= 0 ? "text-[var(--color-accent-green)]" : "text-[var(--color-sell)]"
                  )}
                >
                  {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
