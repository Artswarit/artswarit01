import * as React from "react";
import { cn } from "@/lib/utils";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardTab } from "../dashboardTabs";

export interface DashboardTabBarProps {
  tabs: readonly DashboardTab[];
  /** Optional per-tab numeric badge, keyed by tab value. */
  badges?: Record<string, number | undefined>;
  className?: string;
}

/**
 * Refined desktop segmented control for the dashboards.
 *
 * Replaces the previous heavy pill bar (shadow-xl, oversized radii, uppercase
 * micro-type) with a calm single-surface segment: quiet track, one solid
 * active segment, consistent 44px hit height, sticky-safe.
 */
export const DashboardTabBar: React.FC<DashboardTabBarProps> = ({ tabs, badges, className }) => {
  return (
    <TabsList
      className={cn(
        "h-auto w-full items-stretch gap-1 rounded-2xl border border-border/60 bg-card/80 p-1 shadow-token-xs backdrop-blur-xl",
        "grid",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const badge = badges?.[tab.value];
        return (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className={cn(
              "relative flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium",
              "text-muted-foreground transition-all duration-300 ease-apple",
              "hover:bg-muted/70 hover:text-foreground",
              "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-token-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span className="hidden truncate tracking-tight lg:inline">{tab.label}</span>
            <span className="truncate tracking-tight lg:hidden">{tab.shortLabel}</span>
            {badge ? (
              <span className="ml-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
};

export default DashboardTabBar;
