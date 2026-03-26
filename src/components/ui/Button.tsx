import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-semibold transition-all duration-150 ease-out rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          {
            // Variants
            "bg-[var(--color-accent-green)] text-[var(--color-text-inverse)] hover:brightness-110 hover:shadow-[var(--shadow-green)] active:scale-[0.98]":
              variant === "primary",
            "bg-transparent text-[var(--color-text-primary)] border border-[var(--color-border-default)] hover:border-[var(--color-accent-purple)] hover:text-[var(--color-accent-purple)] hover:shadow-[var(--shadow-purple)]":
              variant === "secondary",
            "bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]":
              variant === "ghost",
            "bg-[var(--color-sell)] text-white hover:brightness-110 active:scale-[0.98]":
              variant === "danger",
            // Sizes
            "h-8 px-3 text-sm gap-1.5": size === "sm",
            "h-10 px-4 text-base gap-2": size === "md",
            "h-12 px-6 text-lg gap-2": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
export { Button };
