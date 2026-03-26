"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Trash2, Building2, CheckCircle2 } from "lucide-react";
import { disconnectBrokerage } from "@/app/actions/settings";

interface BrokerageConnectionCardProps {
  connection: {
    id: string;
    brokerage_name: string;
    account_id: string | null;
    is_active: boolean;
    linked_at: string;
  };
}

export function BrokerageConnectionCard({ connection }: BrokerageConnectionCardProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectBrokerage(connection.id);
      if (result?.error) {
        setError(result.error);
      } else {
        window.location.reload();
      }
    });
  }

  return (
    <div className="px-5 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-md bg-[var(--color-accent-green-glow)] flex items-center justify-center">
          <Building2 size={16} className="text-[var(--color-accent-green)]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {connection.brokerage_name}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Linked {new Date(connection.linked_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="buy">
          <CheckCircle2 size={10} />
          Connected
        </Badge>
        <Button variant="ghost" size="sm" className="text-[var(--color-text-muted)] hover:text-[var(--color-sell)]" onClick={handleDisconnect} disabled={isPending}>
          <Trash2 size={13} />
        </Button>
      </div>
      {error && <p className="text-xs text-[var(--color-sell)]">{error}</p>}
    </div>
  );
}