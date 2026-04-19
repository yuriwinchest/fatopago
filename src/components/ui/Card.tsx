import React from "react";
import { cn } from "../../utils/classNames";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: "default" | "soft" | "elevated";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, tone = "default", ...props }, ref) => {
    const tones = {
      default: "border border-white/10 bg-white/[0.03]",
      soft: "border border-white/10 bg-white/[0.06]",
      elevated: "border border-white/15 bg-white/[0.08] shadow-[var(--platform-surface-shadow)]",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-[var(--platform-card-radius)] p-6 backdrop-blur-sm",
          tones[tone],
          className,
        )}
        {...props}
      />
    );
  },
);

Card.displayName = "Card";

