import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export type StatTone = "primary" | "success" | "warning" | "info" | "neutral";

const toneMap: Record<StatTone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  neutral: "bg-muted text-muted-foreground",
};

export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  /** Optional supporting line under the value — e.g. "3 due this week". */
  hint?: React.ReactNode;
  icon?: LucideIcon;
  /** Custom node rendered inside the icon chip (e.g. a percentage). */
  iconSlot?: React.ReactNode;
  tone?: StatTone;
  onClick?: () => void;
  /** Accessible label for the interactive variant. */
  actionLabel?: string;
  className?: string;
}

/**
 * Canonical dashboard KPI tile.
 *
 * One consistent shape for every stat across the artist, client and admin
 * dashboards: quiet surface, single accent chip, value as the loudest element.
 * Interactive tiles render as a real <button> so keyboard users get focus.
 */
export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  hint,
  icon: Icon,
  iconSlot,
  tone = "primary",
  onClick,
  actionLabel,
  className,
}) => {
  const interactive = typeof onClick === "function";

  const body = (
    <>
      <div className="flex items-center gap-3">
        {(Icon || iconSlot) && (
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-transform duration-300 ease-apple",
              toneMap[tone],
              interactive && "group-hover:scale-105",
            )}
          >
            {iconSlot ?? (Icon ? <Icon className="size-icon-md" /> : null)}
          </span>
        )}
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
      </div>

      <div className="mt-3.5">
        <div className="text-2xl sm:text-[28px] font-semibold leading-none tracking-tight text-foreground truncate">
          {value}
        </div>
        {hint ? (
          <p className="mt-1.5 text-xs text-muted-foreground truncate">{hint}</p>
        ) : null}
      </div>
    </>
  );

  const base = cn(
    "group w-full rounded-2xl border border-border/60 bg-card p-4 sm:p-5 text-left",
    "shadow-token-xs transition-all duration-300 ease-apple",
    interactive &&
      "hover:border-primary/40 hover:shadow-token-sm active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer",
    className,
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} aria-label={actionLabel ?? label} className={base}>
        {body}
      </button>
    );
  }

  return <div className={base}>{body}</div>;
};

export default StatTile;
