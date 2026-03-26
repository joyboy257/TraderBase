import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-medium text-[var(--color-text-secondary)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "h-10 px-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-md text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors duration-150 focus:outline-none focus:border-[var(--color-accent-green)] focus:ring-1 focus:ring-[var(--color-accent-green)]",
            error && "border-[var(--color-sell)] focus:border-[var(--color-sell)] focus:ring-[var(--color-sell)]",
            className
          )}
          {...props}
        />
        {error && (
          <span className="text-xs text-[var(--color-sell)]">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export { Input };
