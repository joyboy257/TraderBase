"use client";

import Link from "next/link";
import { usePolygonPrices } from "@/hooks/usePolygonPrices";
import { BarChart2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

const MOVERS_TICKERS = ["NVDA", "TSLA", "AMD", "META"];

export function MarketMovers() {
  const { prices, isConnected } = usePolygonPrices(MOVERS_TICKERS);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 size={14} className="text-[var(--color-accent-purple)]" />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Market Movers
        </h3>
        <span className="ml-auto flex items-center gap-1">
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
      <div className="space-y-1">
        {MOVERS_TICKERS.map((ticker) => {
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
              className="flex items-center justify-between py-2 px-2 -mx-2 rounded hover:bg-[var(--color-bg-elevated)] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-data font-bold text-sm text-[var(--color-text-primary)]">
                  {ticker}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-data text-sm text-[var(--color-text-secondary)]">
                  {displayPrice}
                </span>
                <span className={cn(
                  "font-data text-xs font-semibold w-14 text-right",
                  changePercent > 0 ? "text-[var(--color-accent-green)]" : changePercent < 0 ? "text-[var(--color-sell)]" : "text-[var(--color-text-muted)]"
                )}>
                  {displayChange}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
