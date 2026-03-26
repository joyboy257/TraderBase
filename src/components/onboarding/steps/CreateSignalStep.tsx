"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createSignal } from "@/app/actions/signals";
import { finishOnboarding } from "@/app/actions/onboarding";
import { TrendingUp, TrendingDown } from "lucide-react";

interface CreateSignalStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function CreateSignalStep({ onComplete, onSkip }: CreateSignalStepProps) {
  const [ticker, setTicker] = useState("");
  const [action, setAction] = useState<"BUY" | "SELL">("BUY");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [rationale, setRationale] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("ticker", ticker);
      formData.set("action", action);
      if (entryPrice) formData.set("entry_price", entryPrice);
      if (stopLoss) formData.set("stop_loss", stopLoss);
      if (takeProfit) formData.set("take_profit", takeProfit);
      if (rationale) formData.set("rationale", rationale);

      const result = await createSignal(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      // Trader is already marked complete in ConnectBrokerageStep.
      // This step is optional — just dismiss the wizard.
      onComplete();
    });
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-2xl text-[var(--color-text-primary)] mb-2">
          Create your first signal
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Share a trade idea with the community. This step is optional.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Ticker */}
        <Input
          label="Ticker"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="AAPL"
          autoFocus
          maxLength={10}
          error={error ?? undefined}
        />

        {/* Action toggle */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">Action</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAction("BUY")}
              className={`flex items-center justify-center gap-2 h-10 rounded-md border transition-all ${
                action === "BUY"
                  ? "border-[var(--color-accent-green)] bg-[var(--color-accent-green-glow)] text-[var(--color-accent-green)]"
                  : "border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]"
              }`}
            >
              <TrendingUp size={16} />
              BUY
            </button>
            <button
              type="button"
              onClick={() => setAction("SELL")}
              className={`flex items-center justify-center gap-2 h-10 rounded-md border transition-all ${
                action === "SELL"
                  ? "border-[var(--color-sell)] bg-[rgba(255,71,87,0.1)] text-[var(--color-sell)]"
                  : "border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]"
              }`}
            >
              <TrendingDown size={16} />
              SELL
            </button>
          </div>
        </div>

        {/* Entry price */}
        <Input
          label="Entry price"
          value={entryPrice}
          onChange={(e) => setEntryPrice(e.target.value)}
          placeholder="Current market price (optional)"
          type="number"
          step="0.01"
          min="0"
        />

        {/* Stop loss + Take profit */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Stop loss"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            placeholder="Optional"
            type="number"
            step="0.01"
            min="0"
          />
          <Input
            label="Take profit"
            value={takeProfit}
            onChange={(e) => setTakeProfit(e.target.value)}
            placeholder="Optional"
            type="number"
            step="0.01"
            min="0"
          />
        </div>

        {/* Rationale */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">
            Rationale <span className="text-[var(--color-text-muted)]">(optional)</span>
          </label>
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Why are you making this trade?"
            maxLength={1000}
            rows={3}
            className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-md text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] text-sm resize-none focus:outline-none focus:border-[var(--color-accent-green)] focus:ring-1 focus:ring-[var(--color-accent-green)] transition-colors"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
            Skip
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isPending || !ticker}
            className="flex-1"
          >
            {isPending ? "Creating..." : "Create Signal"}
          </Button>
        </div>
      </form>
    </div>
  );
}
