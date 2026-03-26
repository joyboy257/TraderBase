import Image from "next/image";
import { cn } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Avatar({ src, alt, size = "md", className }: AvatarProps) {
  const sizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  };

  const innerSizes = {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
  };

  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden bg-[var(--color-bg-elevated)] flex-shrink-0",
        sizes[size],
        className
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={innerSizes[size]}
          height={innerSizes[size]}
          className="object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[var(--color-text-secondary)] font-semibold text-sm">
          {alt.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}
