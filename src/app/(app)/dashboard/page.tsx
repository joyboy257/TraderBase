import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatPercent, timeAgo } from "@/lib/utils";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Users,
  Zap,
  BarChart2,
} from "lucide-react";

// Mock market data — in production from Polygon.io
const marketMovers = [
  { ticker: "NVDA", price: 875.5, change: 3.21 },
  { ticker: "TSLA", price: 242.8, change: -1.55 },
  { ticker: "AMD", price: 178.3, change: 4.12 },
  { ticker: "META", price: 498.7, change: 2.10 },
];

const mockSignals = [
  {
    id: "1",
    user: { username: "sirjack", displayName: "Sir Jack", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop", is_verified: true },
    ticker: "NVDA",
    action: "BUY",
    entry_price: 870.0,
    current_price: 875.5,
    return_pct: 0.63,
    is_verified: true,
    created_at: new Date(Date.now() - 180000).toISOString(),
    note: "Breaking above resistance with volume confirmation. Riding the AI infrastructure wave.",
  },
  {
    id: "2",
    user: { username: "thequant", displayName: "The Quant", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop", is_verified: true },
    ticker: "TSLA",
    action: "SELL",
    entry_price: 248.5,
    current_price: 242.8,
    return_pct: -2.29,
    is_verified: true,
    created_at: new Date(Date.now() - 600000).toISOString(),
    note: "Underperforming sector. Taking profits here before earnings next week.",
  },
  {
    id: "3",
    user: { username: "optionsking", displayName: "Options King", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop", is_verified: true },
    ticker: "SPY",
    action: "BUY",
    entry_price: 519.2,
    current_price: 521.45,
    return_pct: 0.43,
    is_verified: true,
    created_at: new Date(Date.now() - 1200000).toISOString(),
    note: "Holding long calls. Fed meeting next week — expecting dovish tone.",
  },
  {
    id: "4",
    user: { username: "diamondhands", displayName: "Diamond Hands", avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&h=100&fit=crop", is_verified: true },
    ticker: "AAPL",
    action: "BUY",
    entry_price: 182.1,
    current_price: 185.32,
    return_pct: 1.77,
    is_verified: true,
    created_at: new Date(Date.now() - 2400000).toISOString(),
    note: "Services revenue growing 14% YoY. Long term hold, not worried about iPhone cycle.",
  },
];

const followedTraders = [
  {
    id: "1",
    username: "sirjack",
    displayName: "Sir Jack",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop",
    return30d: 42.5,
    copy_ratio: 0.5,
  },
  {
    id: "2",
    username: "thequant",
    displayName: "The Quant",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
    return30d: 35.1,
    copy_ratio: 0.25,
  },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", userId)
    .single();

  const portfolioValue = 12450.67;
  const portfolioChange = 234.50;
  const portfolioChangePct = 2.34;
  const dayStart = 12216.17;
  const isUp = portfolioChange >= 0;

  return (
    <div className="space-y-6">
      {/* Portfolio Hero Row */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-widest mb-2">
            Portfolio Value
          </p>
          <div className="flex items-baseline gap-4">
            <span className="font-data text-5xl font-bold text-[var(--color-text-primary)] tracking-tight">
              {formatCurrency(portfolioValue)}
            </span>
            <div className="flex items-center gap-1.5">
              {isUp ? (
                <TrendingUp size={18} className="text-[var(--color-accent-green)]" />
              ) : (
                <TrendingDown size={18} className="text-[var(--color-sell)]" />
              )}
              <span className={`font-data text-lg font-semibold ${isUp ? "text-[var(--color-accent-green)]" : "text-[var(--color-sell)]"}`}>
                {isUp ? "+" : ""}{formatCurrency(portfolioChange)} ({formatPercent(portfolioChangePct)})
              </span>
              <span className="text-sm text-[var(--color-text-muted)]">today</span>
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Opened at {formatCurrency(dayStart)} · Real-time via Plaid
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/portfolio">
            <Button variant="secondary" size="sm">
              View Portfolio
            </Button>
          </Link>
          <Link href="/settings">
            <Button size="sm">
              Link Brokerage
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Signals Feed */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-[var(--color-accent-green)]" />
              <h2 className="font-semibold text-[var(--color-text-primary)]">Active Signals</h2>
              <span className="text-[10px] font-semibold tracking-widest uppercase text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 rounded">
                Live
              </span>
            </div>
            <Link href="/signals" className="flex items-center gap-1 text-xs text-[var(--color-accent-purple)] hover:underline">
              All signals
              <ArrowRight size={12} />
            </Link>
          </div>

          <div className="space-y-3">
            {mockSignals.map((signal) => (
              <Card key={signal.id} className="p-4 hover:border-[var(--color-border-default)] transition-colors">
                <div className="flex items-start justify-between gap-4">
                  {/* Trader info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Avatar
                      src={signal.user.avatar}
                      alt={signal.user.displayName}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {signal.user.displayName}
                        </span>
                        {signal.user.is_verified && (
                          <Badge variant="verified">Verified</Badge>
                        )}
                        <span className="text-xs text-[var(--color-text-muted)]">
                          @{signal.user.username}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-1">
                        {signal.note}
                      </p>
                    </div>
                  </div>

                  {/* Trade info */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <Badge variant={signal.action === "BUY" ? "buy" : "sell"}>
                        {signal.action}
                      </Badge>
                      <div className="mt-1">
                        <span className="font-data font-bold text-[var(--color-text-primary)] text-base">
                          {signal.ticker}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-data text-xs text-[var(--color-text-muted)] mb-0.5">Entry</p>
                      <p className="font-data text-sm text-[var(--color-text-secondary)]">
                        ${signal.entry_price.toFixed(2)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-data text-xs text-[var(--color-text-muted)] mb-0.5">Now</p>
                      <p className="font-data text-sm text-[var(--color-text-primary)]">
                        ${signal.current_price.toFixed(2)}
                      </p>
                    </div>

                    <div className="text-right w-16">
                      <p className="font-data text-xs text-[var(--color-text-muted)] mb-0.5">Return</p>
                      <p className={`font-data font-semibold text-sm ${signal.return_pct >= 0 ? "text-[var(--color-accent-green)]" : "text-[var(--color-sell)]"}`}>
                        {signal.return_pct >= 0 ? "+" : ""}{signal.return_pct.toFixed(2)}%
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant={signal.action === "BUY" ? "primary" : "secondary"}
                      className="flex-shrink-0"
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Right: Market + Traders */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {/* Market Movers */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={14} className="text-[var(--color-accent-purple)]" />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Market Movers
              </h3>
            </div>
            <div className="space-y-1">
              {marketMovers.map(({ ticker, price, change }) => (
                <Link
                  key={ticker}
                  href={`/chat/${ticker}`}
                  className="flex items-center justify-between py-2 px-2 -mx-2 rounded hover:bg-[var(--color-bg-elevated)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-data font-bold text-sm text-[var(--color-text-primary)]">
                      {ticker}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-data text-sm text-[var(--color-text-secondary)]">
                      ${price.toFixed(2)}
                    </span>
                    <span className={`font-data text-xs font-semibold w-14 text-right ${change >= 0 ? "text-[var(--color-accent-green)]" : "text-[var(--color-sell)]"}`}>
                      {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          {/* Your Traders */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-[var(--color-accent-purple)]" />
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Your Traders
                </h3>
              </div>
              <Link href="/traders" className="text-xs text-[var(--color-accent-purple)] hover:underline">
                Find more
              </Link>
            </div>

            <div className="space-y-3">
              {followedTraders.map((trader) => (
                <div key={trader.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      src={trader.avatar}
                      alt={trader.displayName}
                      size="sm"
                    />
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)] leading-none mb-0.5">
                        {trader.displayName}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {(trader.copy_ratio * 100).toFixed(0)}% copy
                      </p>
                    </div>
                  </div>
                  <span className={`font-data text-sm font-semibold ${trader.return30d >= 0 ? "text-[var(--color-accent-green)]" : "text-[var(--color-sell)]"}`}>
                    +{trader.return30d.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
