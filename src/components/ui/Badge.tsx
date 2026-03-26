import { cn } from "@/lib/utils";

interface BadgeProps {
  variant: "buy" | "sell" | "verified" | "neutral";
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold font-data",
        {
          "bg-[var(--color-accent-green-glow)] text-[var(--color-buy)] border border-[var(--color-accent-green-dim)]":
            variant === "buy",
          "bg-[rgba(255,71,87,0.15)] text-[var(--color-sell)] border border-[rgba(255,71,87,0.4)]":
            variant === "sell",
          "bg-[var(--color-accent-purple-glow)] text-[var(--color-accent-purple)] border border-[var(--color-accent-purple-dim)]":
            variant === "verified",
          "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)]":
            variant === "neutral",
        },
        className
      )}
    >
      {variant === "verified" && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="currentColor"
        >
          <path d="M8.5 2.5L4 7.5L1.5 5L2.5 4L4 5.5L7.5 1.5L8.5 2.5Z" />
        </svg>
      )}
      {children}
    </span>
  );
}
