import * as React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Canonical empty-state primitive.
 *
 * Pattern derived from the most-common usages across the dashboard
 * (SavedArtists, PurchasedArtworks, NotificationCenter, ProjectManagement, etc.).
 *
 * Intentionally unopinionated about wrapping <Card>. Pages that need a card
 * frame should wrap <EmptyState/> themselves.
 *
 * Visual decisions encoded:
 *  - Centered column with `font-black` title (brand standard)
 *  - Optional Lucide icon OR emoji (both patterns exist in the wild)
 *  - Action slot accepts any node (Button, Link-as-Button, multiple buttons)
 */
export interface EmptyStateProps {
  icon?: LucideIcon;
  emoji?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { wrap: "py-8", icon: "h-10 w-10", title: "text-base", desc: "text-sm" },
  md: { wrap: "py-12", icon: "h-12 w-12", title: "text-lg", desc: "text-sm" },
  lg: { wrap: "py-16", icon: "h-16 w-16", title: "text-xl", desc: "text-sm sm:text-base" },
} as const;

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  emoji,
  title,
  description,
  action,
  className,
  size = "md",
}) => {
  const s = sizeMap[size];
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6",
        s.wrap,
        className,
      )}
      role="status"
    >
      {Icon ? (
        <Icon className={cn("text-muted-foreground mb-4", s.icon)} aria-hidden />
      ) : emoji ? (
        <div className="text-4xl mb-4" aria-hidden>
          {emoji}
        </div>
      ) : null}
      <h3 className={cn("font-black tracking-tight text-foreground mb-2", s.title)}>
        {title}
      </h3>
      {description ? (
        <p
          className={cn(
            "text-muted-foreground max-w-sm leading-relaxed font-medium opacity-80",
            s.desc,
            action && "mb-6",
          )}
        >
          {description}
        </p>
      ) : null}
      {action ? <div className="flex flex-wrap items-center justify-center gap-3">{action}</div> : null}
    </div>
  );
};

export default EmptyState;
