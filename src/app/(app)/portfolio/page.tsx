import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function PortfolioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: positions } = await supabase
    .from("positions")
    .select("*")
    .eq("user_id", user!.id)
    .order("ticker");

  // Mock portfolio data if none exists
  const mockPositions = positions ?? [
    { id: "1", ticker: "AAPL", quantity: 50, average_cost: 172.5, current_price: 185.2 },
    { id: "2", ticker: "NVDA", quantity: 20, average_cost: 650.0, current_price: 875.5 },
    { id: "3", ticker: "TSLA", quantity: 30, average_cost: 220.0, current_price: 242.8 },
  ];

  const totalValue = mockPositions.reduce(
    (sum, p) => sum + p.quantity * (p.current_price ?? p.average_cost),
    0
  );

  const totalCost = mockPositions.reduce(
    (sum, p) => sum + p.quantity * p.average_cost,
    0
  );

  const totalPnL = totalValue - totalCost;
  const totalPnLPct = ((totalPnL / totalCost) * 100).toFixed(2);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl text-[var(--color-text-primary)] mb-2">
          Portfolio
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Your holdings across all linked brokerages
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Card className="p-6">
          <span className="text-xs text-[var(--color-text-muted)] block mb-2">
            Total Value
          </span>
          <span className="font-data text-2xl font-bold text-[var(--color-text-primary)]">
            ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </Card>
        <Card className="p-6">
          <span className="text-xs text-[var(--color-text-muted)] block mb-2">
            Total P&L
          </span>
          <span
            className={`font-data text-2xl font-bold ${
              totalPnL >= 0
                ? "text-[var(--color-accent-green)]"
                : "text-[var(--color-sell)]"
            }`}
          >
            {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)} ({totalPnLPct}%)
          </span>
        </Card>
        <Card className="p-6">
          <span className="text-xs text-[var(--color-text-muted)] block mb-2">
            Holdings
          </span>
          <span className="font-data text-2xl font-bold text-[var(--color-text-primary)]">
            {mockPositions.length}
          </span>
        </Card>
      </div>

      {/* Positions table */}
      <Card>
        <div className="px-6 py-4 border-b border-[var(--color-border-subtle)]">
          <h2 className="font-semibold text-[var(--color-text-primary)]">
            Holdings
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                <th className="px-6 py-3 text-left">Ticker</th>
                <th className="px-6 py-3 text-right">Quantity</th>
                <th className="px-6 py-3 text-right">Avg Cost</th>
                <th className="px-6 py-3 text-right">Current Price</th>
                <th className="px-6 py-3 text-right">Market Value</th>
                <th className="px-6 py-3 text-right">P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {mockPositions.map((position) => {
                const marketValue = position.quantity * (position.current_price ?? position.average_cost);
                const costBasis = position.quantity * position.average_cost;
                const pnl = marketValue - costBasis;
                const pnlPct = ((pnl / costBasis) * 100).toFixed(2);
                const isPositive = pnl >= 0;

                return (
                  <tr key={position.id} className="hover:bg-[var(--color-bg-elevated)] transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-data font-bold text-[var(--color-text-primary)]">
                        {position.ticker}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-data text-[var(--color-text-secondary)]">
                      {position.quantity}
                    </td>
                    <td className="px-6 py-4 text-right font-data text-[var(--color-text-secondary)]">
                      ${position.average_cost.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-data text-[var(--color-text-primary)]">
                      ${(position.current_price ?? position.average_cost).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-data font-semibold text-[var(--color-text-primary)]">
                      ${marketValue.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`font-data font-semibold ${isPositive ? "text-[var(--color-accent-green)]" : "text-[var(--color-sell)]"}`}>
                        {isPositive ? "+" : ""}${pnl.toFixed(2)}
                      </div>
                      <div className={`text-xs font-data ${isPositive ? "text-[var(--color-accent-green)]" : "text-[var(--color-sell)]"}`}>
                        {isPositive ? "+" : ""}{pnlPct}%
                      </div>
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
