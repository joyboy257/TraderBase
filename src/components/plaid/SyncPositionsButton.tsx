"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { RefreshCw, CheckCircle2 } from "lucide-react";

export function SyncPositionsButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const response = await fetch("/api/plaid/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Sync failed");
      }
      setLastSynced(`Synced ${data.synced} account${data.synced !== 1 ? "s" : ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {lastSynced && (
        <span className="text-xs text-[var(--color-accent-green)] flex items-center gap-1">
          <CheckCircle2 size={10} />
          {lastSynced}
        </span>
      )}
      <Button variant="ghost" size="sm" onClick={handleSync} disabled={isSyncing}>
        <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
        Sync positions
      </Button>
    </div>
  );
}
