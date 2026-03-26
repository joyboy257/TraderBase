"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";

interface CopySignalButtonProps {
  signalId: string;
  ticker: string;
  action: "BUY" | "SELL";
  variant?: "primary" | "secondary";
  followerId: string;
}

export function CopySignalButton({ signalId, ticker, action, variant, followerId }: CopySignalButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCopy() {
    if (!followerId) {
      setError("Sign in to copy");
      return;
    }
    startTransition(async () => {
      const { triggerCopyTrade } = await import("@/app/actions/copy-trading");
      const result = await triggerCopyTrade(followerId, signalId);
      if (result?.success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } else {
        setError(result?.error ?? "Failed to copy trade");
        setTimeout(() => setError(null), 3000);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={variant ?? (action === "BUY" ? "primary" : "secondary")}
        onClick={handleCopy}
        disabled={isPending}
      >
        {isPending ? "..." : copied ? "Copied!" : "Copy"}
      </Button>
      {error && <span className="text-[10px] text-[var(--color-sell)]">{error}</span>}
    </div>
  );
}
