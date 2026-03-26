import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { MessageCircle, TrendingUp, TrendingDown } from "lucide-react";

const POPULAR_TICKERS = [
  { ticker: "AAPL", name: "Apple Inc.", change: 1.24, messages: 1243 },
  { ticker: "NVDA", name: "NVIDIA Corp.", change: 3.21, messages: 2341 },
  { ticker: "TSLA", name: "Tesla Inc.", change: -1.55, messages: 3892 },
  { ticker: "META", name: "Meta Platforms", change: 2.10, messages: 1823 },
  { ticker: "AMZN", name: "Amazon", change: 0.87, messages: 987 },
  { ticker: "GOOGL", name: "Alphabet", change: -0.43, messages: 756 },
  { ticker: "MSFT", name: "Microsoft", change: 1.12, messages: 1102 },
  { ticker: "SPY", name: "SPDR S&P 500", change: 0.33, messages: 4210 },
  { ticker: "QQQ", name: "Invesco QQQ", change: 0.71, messages: 2103 },
  { ticker: "AMD", name: "AMD", change: 4.12, messages: 1543 },
  { ticker: "NFLX", name: "Netflix", change: -2.34, messages: 892 },
  { ticker: "DIS", name: "Walt Disney", change: 0.55, messages: 643 },
  { ticker: "PYPL", name: "PayPal", change: -0.89, messages: 521 },
  { ticker: "COIN", name: "Coinbase", change: 5.67, messages: 1876 },
  { ticker: "PLTR", name: "Palantir", change: 2.23, messages: 1342 },
  { ticker: "GME", name: "GameStop", change: -3.41, messages: 2567 },
];

export default async function ChatPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-text-primary)] tracking-tight">
            Chat
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            Live discussions for {POPULAR_TICKERS.length} tickers
          </p>
        </div>
        <Badge variant="neutral" className="text-xs">
          <MessageCircle size={10} className="mr-1" />
          Powered by Supabase Realtime
        </Badge>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {POPULAR_TICKERS.map(({ ticker, name, change, messages }) => (
          <Link key={ticker} href={`/chat/${ticker}`}>
            <Card className="p-4 hover:border-[var(--color-accent-purple)] transition-colors cursor-pointer group">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-md bg-[var(--color-bg-elevated)] flex items-center justify-center flex-shrink-0">
                    <span className="font-data font-bold text-xs text-[var(--color-accent-green)]">
                      {ticker.slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="font-data font-bold text-sm text-[var(--color-text-primary)]">
                      {ticker}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate max-w-[120px]">
                      {name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {change >= 0 ? (
                    <TrendingUp size={11} className="text-[var(--color-accent-green)]" />
                  ) : (
                    <TrendingDown size={11} className="text-[var(--color-sell)]" />
                  )}
                  <span className={`font-data text-xs font-semibold ${change >= 0 ? "text-[var(--color-accent-green)]" : "text-[var(--color-sell)]"}`}>
                    {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <MessageCircle size={11} className="text-[var(--color-text-muted)]" />
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {messages.toLocaleString()} messages
                  </span>
                </div>
                <span className="text-xs text-[var(--color-accent-purple)] opacity-0 group-hover:opacity-100 transition-opacity">
                  Join →
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
