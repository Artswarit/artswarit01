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
        "h-auto w-full items-stretch gap-0.5 rounded-2xl border border-border/60 bg-card/80 p-1 shadow-token-xs backdrop-blur-xl",
        "flex overflow-x-auto no-scrollbar",
        className,
      )}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const badge = badges?.[tab.value];
        return (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className={cn(
              "relative flex min-w-max shrink-0 min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 sm:px-3 text-[12px] sm:text-[13px] font-medium whitespace-nowrap",
              "text-muted-foreground transition-all duration-200 ease-apple",
              "hover:bg-muted/70 hover:text-foreground",
              "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-token-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            )}
          >
            <Icon className="h-[14px] w-[14px] shrink-0" />
            <span>{tab.label}</span>
            {badge ? (
              <span className="ml-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground">
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
