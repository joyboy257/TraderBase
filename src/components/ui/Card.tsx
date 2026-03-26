import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover = false }: CardProps) {
  return (
    <div
      className={cn(
        "bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-lg transition-all duration-250",
        hover && "hover:border-[var(--color-border-default)] hover:shadow-[var(--shadow-md)]",
        className
      )}
    >
      {children}
    </div>
  );
}
