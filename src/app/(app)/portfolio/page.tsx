import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Briefcase, TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";

const positions = [
  { id: "1", ticker: "AAPL", name: "Apple Inc.", quantity: 50, avgCost: 172.50, currentPrice: 185.32, sector: "Technology" },
  { id: "2", ticker: "NVDA", name: "NVIDIA Corp.", quantity: 20, avgCost: 650.00, currentPrice: 875.50, sector: "Semiconductors" },
  { id: "3", ticker: "TSLA", name: "Tesla Inc.", quantity: 30, avgCost: 220.00, currentPrice: 242.80, sector: "EV / Auto" },
  { id: "4", ticker: "META", name: "Meta Platforms", quantity: 15, avgCost: 480.00, currentPrice: 498.70, sector: "Social Media" },
];

export default async function PortfolioPage() {
  const totalValue = positions.reduce((sum, p) => sum + p.quantity * p.currentPrice, 0);
  const totalCost = positions.reduce((sum, p) => sum + p.quantity * p.avgCost, 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPct = (totalPnL / totalCost) * 100;
  const dayChange = 234.50;
  const dayChangePct = (dayChange / (totalValue - dayChange)) * 100;
  const isUp = dayChange >= 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-text-primary)] tracking-tight">
            Portfolio
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            Holdings across 2 linked brokerages · Real-time via Plaid
          </p>
        </div>
        <Badge variant="neutral" className="text-xs">
          <ExternalLink size={10} className="mr-1" />
          Plaid Connected
        </Badge>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-12 gap-4">
        {/* Main value card */}
        <Card className="col-span-12 lg:col-span-5 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
            Total Portfolio Value
          </p>
          <p className="font-data text-4xl font-bold text-[var(--color-text-primary)] tracking-tight mb-1">
            {formatCurrency(totalValue)}
          </p>
          <div className="flex items-center gap-2 mb-4">
            {isUp ? (
              <TrendingUp size={14} className="text-[var(--color-accent-green)]" />
            ) : (
              <TrendingDown size={14} className="text-[var(--color-sell)]" />
            )}
            <span className={`font-data text-sm font-semibold ${isUp ? "text-[var(--color-accent-green)]" : "text-[var(--color-sell)]"}`}>
              {isUp ? "+" : ""}{formatCurrency(dayChange)} ({formatPercent(dayChangePct)})
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">today</span>
          </div>
          <div className="h-1 w-full bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent-green)] rounded-full"
              style={{ width: `${Math.min((dayChangePct / 5) * 100, 100)}%` }}
            />
          </div>
        </Card>

        {/* P&L summary */}
        <Card className="col-span-6 lg:col-span-3 p-5 flex flex-col justify-between">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">Total P&L</p>
          <p className={`font-data text-2xl font-bold ${totalPnL >= 0 ? "text-[var(--color-accent-green)]" : "text-[var(--color-sell)]"}`}>
            {totalPnL >= 0 ? "+" : ""}{formatCurrency(totalPnL)}
          </p>
          <p className={`font-data text-sm ${totalPnLPct >= 0 ? "text-[var(--color-accent-green)]" : "text-[var(--color-sell)]"}`}>
            {totalPnLPct >= 0 ? "+" : ""}{totalPnLPct.toFixed(2)}% all-time
          </p>
        </Card>

        {/* Cost basis */}
        <Card className="col-span-6 lg:col-span-2 p-5 flex flex-col justify-between">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">Cost Basis</p>
          <p className="font-data text-2xl font-bold text-[var(--color-text-primary)]">
            {formatCurrency(totalCost)}
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">invested</p>
        </Card>

        {/* Positions count */}
        <Card className="col-span-6 lg:col-span-2 p-5 flex flex-col justify-between">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">Holdings</p>
          <p className="font-data text-2xl font-bold text-[var(--color-text-primary)]">
            {positions.length}
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">positions</p>
        </Card>
      </div>

      {/* Positions Table */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border-subtle)] flex items-center gap-2">
          <Briefcase size={14} className="text-[var(--color-text-muted)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Holdings</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)]">
                {["Ticker", "Name", "Sector", "Qty", "Avg Cost", "Current", "Market Value", "P&L", "P&L %"].map((col) => (
                  <th
                    key={col}
                    className={`px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] ${
                      ["Current", "Market Value", "P&L", "P&L %"].includes(col) ? "text-right" : ""
                    }`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {positions.map((pos) => {
                const marketValue = pos.quantity * pos.currentPrice;
                const costBasis = pos.quantity * pos.avgCost;
                const pnl = marketValue - costBasis;
                const pnlPct = (pnl / costBasis) * 100;
                const isPositive = pnl >= 0;

                return (
                  <tr key={pos.id} className="hover:bg-[var(--color-bg-elevated)] transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-data font-bold text-sm text-[var(--color-text-primary)]">
                        {pos.ticker}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-[var(--color-text-secondary)]">{pos.name}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-[var(--color-text-muted)]">{pos.sector}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="font-data text-sm text-[var(--color-text-secondary)]">
                        {pos.quantity}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="font-data text-sm text-[var(--color-text-secondary)]">
                        ${pos.avgCost.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="font-data text-sm text-[var(--color-text-primary)]">
                        ${pos.currentPrice.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="font-data text-sm font-semibold text-[var(--color-text-primary)]">
                        {formatCurrency(marketValue)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className={`font-data text-sm font-semibold ${isPositive ? "text-[var(--color-accent-green)]" : "text-[var(--color-sell)]"}`}>
                        {isPositive ? "+" : ""}{formatCurrency(pnl)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className={`font-data text-sm font-semibold ${isPositive ? "text-[var(--color-accent-green)]" : "text-[var(--color-sell)]"}`}>
                        {isPositive ? "+" : ""}{pnlPct.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
