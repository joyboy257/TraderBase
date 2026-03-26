import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatPercent, timeAgo } from "@/lib/utils";
import { Filter, ArrowUpDown } from "lucide-react";

const mockSignals = [
  { id: "1", user: { username: "sirjack", displayName: "Sir Jack", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop", is_verified: true }, ticker: "NVDA", action: "BUY", entry_price: 870.0, current_price: 875.5, return_pct: 0.63, is_verified: true, stop_loss: 860.0, created_at: new Date(Date.now() - 180000).toISOString() },
  { id: "2", user: { username: "thequant", displayName: "The Quant", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop", is_verified: true }, ticker: "TSLA", action: "SELL", entry_price: 248.5, current_price: 242.8, return_pct: -2.29, is_verified: true, stop_loss: 252.0, created_at: new Date(Date.now() - 600000).toISOString() },
  { id: "3", user: { username: "optionsking", displayName: "Options King", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop", is_verified: true }, ticker: "SPY", action: "BUY", entry_price: 519.2, current_price: 521.45, return_pct: 0.43, is_verified: true, created_at: new Date(Date.now() - 1200000).toISOString() },
  { id: "4", user: { username: "diamondhands", displayName: "Diamond Hands", avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&h=100&fit=crop", is_verified: true }, ticker: "AAPL", action: "BUY", entry_price: 182.1, current_price: 185.32, return_pct: 1.77, is_verified: true, created_at: new Date(Date.now() - 2400000).toISOString() },
  { id: "5", user: { username: "valuehunter", displayName: "Value Hunter", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop", is_verified: false }, ticker: "META", action: "BUY", entry_price: 490.0, current_price: 498.7, return_pct: 1.78, is_verified: false, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: "6", user: { username: "divhunter", displayName: "Div Hunter", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop", is_verified: true }, ticker: "JNJ", action: "BUY", entry_price: 155.0, current_price: 156.2, return_pct: 0.77, is_verified: true, created_at: new Date(Date.now() - 5400000).toISOString() },
];

const followedIds = new Set(["1", "2"]);

export default async function SignalsPage() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-text-primary)] tracking-tight">
            Signals
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {mockSignals.length} active signals · Real-time via verified brokerages
          </p>
        </div>
        <Button size="sm">Create Signal</Button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search ticker..."
          className="w-48"
        />
        <div className="flex items-center gap-1">
          {["All", "BUY", "SELL"].map((f) => (
            <button
              key={f}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                f === "All"
                  ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                  : f === "BUY"
                  ? "bg-[var(--color-accent-green-glow)] text-[var(--color-accent-green)]"
                  : "bg-[rgba(255,71,87,0.15)] text-[var(--color-sell)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer ml-auto">
          <input type="checkbox" className="w-3.5 h-3.5 accent-[var(--color-accent-green)]" />
          Verified only
        </label>
      </div>

      {/* Table */}
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
          {mockSignals.map((signal) => (
            <div
              key={signal.id}
              className="grid grid-cols-12 gap-4 px-5 py-3.5 items-center hover:bg-[var(--color-bg-elevated)] transition-colors group"
            >
              {/* Trader */}
              <div className="col-span-3 flex items-center gap-2.5">
                <Avatar src={signal.user.avatar} alt={signal.user.displayName} size="sm" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {signal.user.displayName}
                    </span>
                    {signal.user.is_verified && <Badge variant="verified">V</Badge>}
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">@{signal.user.username}</span>
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
                  ${signal.entry_price.toFixed(2)}
                </span>
              </div>

              {/* Current */}
              <div className="col-span-1">
                <span className="font-data text-sm text-[var(--color-text-primary)]">
                  ${signal.current_price.toFixed(2)}
                </span>
              </div>

              {/* Return */}
              <div className="col-span-1">
                <span className={`font-data font-semibold text-sm ${signal.return_pct >= 0 ? "text-[var(--color-accent-green)]" : "text-[var(--color-sell)]"}`}>
                  {signal.return_pct >= 0 ? "+" : ""}{signal.return_pct.toFixed(2)}%
                </span>
              </div>

              {/* Stop Loss */}
              <div className="col-span-1">
                <span className="font-data text-xs text-[var(--color-text-muted)]">
                  {signal.stop_loss ? `$${signal.stop_loss.toFixed(2)}` : "—"}
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
                <Button
                  size="sm"
                  variant={followedIds.has(signal.id) ? "primary" : "secondary"}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {followedIds.has(signal.id) ? "Copy" : "Follow to copy"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
