"use client";

import { useState, useCallback, useEffect } from "react";
import { usePlaidLink, PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import { Button } from "@/components/ui/Button";
import { Loader2 } from "lucide-react";

interface PlaidLinkProps {
  onSuccess?: (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => void;
  onExit?: () => void;
  children?: React.ReactNode;
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PlaidLink({
  onSuccess,
  onExit,
  children,
  variant = "primary",
  size = "md",
  className,
}: PlaidLinkProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: (publicToken, metadata) => {
      onSuccess?.(publicToken, metadata);
    },
    onExit: () => {
      onExit?.();
    },
  });

  // When token arrives and Plaid is ready, open the modal automatically
  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  const handleClick = useCallback(async () => {
    if (linkToken) {
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
  }, [linkToken, open]);

  if (error) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-[var(--color-sell)]">{error}</p>
        <Button
          variant="secondary"
          size={size}
          onClick={() => { setError(null); handleClick(); }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          Connecting...
        </>
      ) : (
        children
      )}
    </Button>
  );
}
