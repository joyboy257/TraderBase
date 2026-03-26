import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import Link from "next/link";

const POPULAR_TICKERS = [
  "AAPL", "NVDA", "TSLA", "META", "AMZN", "GOOGL", "MSFT", "SPY", "QQQ", "AMD",
  "NFLX", "DIS", "PYPL", "SQ", "COIN", "PLTR", "GME", "AMC", "BB", "NOK"
];

export default async function ChatPage() {
  const supabase = await createClient();

  // Get message counts per room
  const { data: messageCounts } = await supabase
    .from("chat_messages")
    .select("room_id, chat_rooms!inner(ticker)")
    .limit(100);

  const countByRoom = new Map();
  messageCounts?.forEach((msg: any) => {
    const ticker = msg.chat_rooms?.ticker;
    if (ticker) countByRoom.set(ticker, (countByRoom.get(ticker) ?? 0) + 1);
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-[var(--color-text-primary)] mb-2">
          Chat
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Join live discussions for your favorite tickers
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {POPULAR_TICKERS.map((ticker) => (
          <Link key={ticker} href={`/chat/${ticker}`}>
            <Card className="p-6 hover:border-[var(--color-accent-purple)] transition-colors cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-elevated)] flex items-center justify-center">
                    <span className="font-data font-bold text-[var(--color-accent-green)]">
                      {ticker.slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <span className="font-data font-bold text-[var(--color-text-primary)]">
                      ${ticker}
                    </span>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {countByRoom.get(ticker) ?? 0} messages
                    </div>
                  </div>
                </div>
                <span className="text-2xl">💬</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
