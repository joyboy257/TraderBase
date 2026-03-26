"use client";

import { useState } from "react";
import { usePlaidLink, PlaidLinkOptions } from "react-plaid-link";
import { Button } from "@/components/ui/Button";
import { Loader2, Plus } from "lucide-react";

interface BrokerageConnectorProps {
  onConnected?: () => void;
}

export function BrokerageConnector({ onConnected }: BrokerageConnectorProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: async (publicToken, metadata) => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token: publicToken, metadata }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to connect brokerage");
        }
        onConnected?.();
        // Force page refresh to show new connection
        window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to connect brokerage");
      } finally {
        setIsLoading(false);
      }
    },
    onExit: () => {
      setIsLoading(false);
    },
  });

  const handleConnect = async () => {
    if (linkToken && ready) {
      open();
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/plaid/create-link-token", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create link token");
      }
      setLinkToken(data.link_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect brokerage");
    } finally {
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-[var(--color-sell)]">{error}</p>
        <Button variant="secondary" size="sm" onClick={() => { setError(null); handleConnect(); }}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="primary"
      size="sm"
      onClick={handleConnect}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 size={13} className="animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <Plus size={13} />
          Link Brokerage
        </>
      )}
    </Button>
  );
}
