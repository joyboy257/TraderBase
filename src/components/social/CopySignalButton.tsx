"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { BrokerageConnector } from "@/components/plaid/BrokerageConnector";

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
  const [showBrokerageModal, setShowBrokerageModal] = useState(false);

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
      } else if (result?.error === "NO_BROKERAGE") {
        setShowBrokerageModal(true);
      } else {
        setError(result?.error ?? "Failed to copy trade");
        setTimeout(() => setError(null), 3000);
      }
    });
  }

  return (
    <>
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

      {showBrokerageModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowBrokerageModal(false)} />
          <div className="relative w-full max-w-sm mx-4 bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl p-6 shadow-2xl">
            <div className="text-center mb-4">
              <p className="font-semibold text-[var(--color-text-primary)] mb-1">
                Connect a brokerage to copy trades
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                Linking a brokerage lets you automatically copy this trader&apos;s positions.
              </p>
            </div>
            <div className="flex justify-center mb-4">
              <BrokerageConnector onConnected={() => setShowBrokerageModal(false)} skipReload={true} />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowBrokerageModal(false)} className="w-full">
              Cancel
            </Button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
