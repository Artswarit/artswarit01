import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Canonical page / section header.
 *
 * Pattern derived from dashboards and content pages (Explore, Categories,
 * DashboardHeader). Uses `font-black` and `tracking-tight` per brand spec.
 *
 * NOT a replacement for marketing hero sections — those keep bespoke layouts.
 */
export interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  align?: "left" | "center";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "text-xl sm:text-2xl",
  md: "text-2xl sm:text-3xl",
  lg: "text-3xl sm:text-4xl",
} as const;

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  eyebrow,
  actions,
  align = "left",
  size = "md",
  className,
}) => {
  const alignment = align === "center" ? "items-center text-center" : "items-start text-left";
  return (
    <header
      className={cn(
        "w-full flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className={cn("flex flex-col gap-1", alignment)}>
        {eyebrow ? (
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            {eyebrow}
          </div>
        ) : null}
        <h1 className={cn("font-black tracking-tight text-foreground", sizeMap[size])}>
          {title}
        </h1>
        {description ? (
          <p className="text-sm sm:text-base text-muted-foreground font-medium max-w-2xl">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:shrink-0">{actions}</div>
      ) : null}
    </header>
  );
};

export default PageHeader;
