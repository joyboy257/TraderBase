import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatPercent, formatCompactNumber } from "@/lib/utils";
import { Users, TrendingUp, Zap, ExternalLink } from "lucide-react";

const mockTraders = [
  { id: "1", username: "sirjack", displayName: "Sir Jack", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop", bio: "Momentum trader. 10+ years experience. I ride the waves.", return30d: 42.5, followers: 12400, signals: 156, isVerified: true, isFollowing: true },
  { id: "2", username: "thequant", displayName: "The Quant", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop", bio: "Algorithmic strategies. Low frequency, high conviction.", return30d: 35.1, followers: 15600, signals: 89, isVerified: true, isFollowing: true },
  { id: "3", username: "optionsking", displayName: "Options King", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop", bio: "Premium selling and directional options trades.", return30d: 67.2, followers: 22100, signals: 234, isVerified: true, isFollowing: false },
  { id: "4", username: "diamondhands", displayName: "Diamond Hands", avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&h=100&fit=crop", bio: "Long-term value investing. Patience is the edge.", return30d: 18.7, followers: 8900, signals: 45, isVerified: true, isFollowing: false },
  { id: "5", username: "valuehunter", displayName: "Value Hunter", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop", bio: "Deep value. Contrarian. Currently long energy and financials.", return30d: 12.4, followers: 6200, signals: 67, isVerified: true, isFollowing: false },
  { id: "6", username: "divhunter", displayName: "Div Hunter", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop", bio: "Yield-focused. Building passive income through dividend growth.", return30d: 8.3, followers: 4800, signals: 112, isVerified: true, isFollowing: false },
];

export default async function TradersPage() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-text-primary)] tracking-tight">
            Traders
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {mockTraders.length} verified traders · All linked to live brokerage accounts
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="px-5 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[var(--color-accent-green-glow)] flex items-center justify-center">
            <Users size={14} className="text-[var(--color-accent-green)]" />
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Total Followers</p>
            <p className="font-data font-semibold text-[var(--color-text-primary)]">68.7K</p>
          </div>
        </Card>
        <Card className="px-5 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[var(--color-accent-purple-glow)] flex items-center justify-center">
            <TrendingUp size={14} className="text-[var(--color-accent-purple)]" />
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Avg 30D Return</p>
            <p className="font-data font-semibold text-[var(--color-accent-green)]">+24.6%</p>
          </div>
        </Card>
        <Card className="px-5 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[rgba(255,71,87,0.1)] flex items-center justify-center">
            <Zap size={14} className="text-[var(--color-sell)]" />
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Signals Today</p>
            <p className="font-data font-semibold text-[var(--color-text-primary)]">127</p>
          </div>
        </Card>
      </div>

      {/* Traders grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {mockTraders.map((trader) => (
          <Card key={trader.id} className="p-5 hover:border-[var(--color-border-default)] transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <Avatar
                  src={trader.avatar}
                  alt={trader.displayName}
                  size="lg"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-semibold text-[var(--color-text-primary)] truncate">
                      {trader.displayName}
                    </span>
                    {trader.isVerified && <Badge variant="verified">Verified</Badge>}
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    @{trader.username}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <p className={`font-data font-bold text-xl ${trader.return30d >= 0 ? "text-[var(--color-accent-green)]" : "text-[var(--color-sell)]"}`}>
                  {trader.return30d >= 0 ? "+" : ""}{trader.return30d.toFixed(1)}%
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">30D Return</p>
              </div>
            </div>

            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-4 line-clamp-2">
              {trader.bio}
            </p>

            <div className="flex items-center gap-6 mb-4">
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Followers</p>
                <p className="font-data font-semibold text-sm text-[var(--color-text-primary)]">
                  {formatCompactNumber(trader.followers)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Signals</p>
                <p className="font-data font-semibold text-sm text-[var(--color-text-primary)]">
                  {trader.signals}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant={trader.isFollowing ? "secondary" : "primary"}
                size="sm"
                className="flex-1"
              >
                {trader.isFollowing ? "Following" : "Follow"}
              </Button>
              <Button variant="ghost" size="sm" className="px-2">
                <ExternalLink size={14} />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
