"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { saveCopySettings } from "@/app/actions/settings";

export function CopySettingsForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [ratio, setRatio] = useState(50);
  const [maxPosition, setMaxPosition] = useState(500);
  const [isActive, setIsActive] = useState(true);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("is_active", String(isActive));
    startTransition(async () => {
      setError(null);
      const result = await saveCopySettings(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            Enable Copy Trading
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Automatically copy trades from traders you follow
          </p>
        </div>
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-[var(--color-accent-green)]"
        />
      </label>

      <div>
        <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">
          Default Copy Ratio
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            name="copy_ratio"
            min="10"
            max="100"
            value={ratio}
            onChange={(e) => setRatio(Number(e.target.value))}
            className="flex-1 accent-[var(--color-accent-green)]"
          />
          <span className="font-data text-sm text-[var(--color-text-primary)] w-12 text-right">
            {ratio}%
          </span>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">
          Max Position Size
        </label>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--color-text-muted)]">$</span>
          <input
            type="number"
            name="max_position_size"
            value={maxPosition}
            onChange={(e) => setMaxPosition(Number(e.target.value))}
            className="w-32 h-10 px-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-green)] text-sm font-data"
          />
        </div>
      </div>

      {error && <p className="text-xs text-[var(--color-sell)]">{error}</p>}
      {success && <p className="text-xs text-[var(--color-accent-green)]">Copy settings saved!</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving..." : "Save Copy Settings"}
        </Button>
      </div>
    </form>
  );
}