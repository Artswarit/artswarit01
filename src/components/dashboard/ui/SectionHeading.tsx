import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface SectionHeadingProps {
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  /** Right-aligned actions — keep to one primary + one quiet link. */
  actions?: React.ReactNode;
  /** Small count/label chip after the title. */
  meta?: React.ReactNode;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Section-level heading used inside dashboard tabs.
 *
 * Establishes a single hierarchy step below the page title so panels stop
 * competing with each other (previously each block invented its own weight,
 * casing and size).
 */
export const SectionHeading: React.FC<SectionHeadingProps> = ({
  title,
  description,
  icon: Icon,
  actions,
  meta,
  size = "md",
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="size-icon-md shrink-0 text-muted-foreground" /> : null}
          <h2
            className={cn(
              "font-semibold tracking-tight text-foreground truncate",
              size === "sm" ? "text-base" : "text-lg sm:text-xl",
            )}
          >
            {title}
          </h2>
          {meta ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {meta}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
};

export default SectionHeading;
