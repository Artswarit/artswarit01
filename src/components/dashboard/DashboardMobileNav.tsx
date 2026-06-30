import React from 'react';
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import { getDashboardTabs } from "./dashboardTabs";

interface DashboardMobileNavProps {
  activeTab: string;
  onTabChange: (value: string) => void;
  role: 'artist' | 'client';
  isLocked?: boolean; // Whether non-account tabs are locked
}

const DashboardMobileNav = ({
  activeTab,
  onTabChange,
  role,
  isLocked = false
}: DashboardMobileNavProps) => {

  // Mobile tab list is derived from the same config the desktop dashboards
  // use, so the two surfaces cannot silently fall out of sync when a new
  // top-level tab is added. See src/components/dashboard/dashboardTabs.ts.
  const tabs = getDashboardTabs(role).map((t) => ({
    value: t.value,
    label: t.mobileLabel,
    icon: t.icon,
  }));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] sm:hidden pb-[env(safe-area-inset-bottom)]">
      {/* Decorative background glassmorphism */}
      <div className="absolute inset-0 bg-white/80 dark:bg-card/90 backdrop-blur-2xl border-t border-border/40 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]" />
      
      <div className="relative flex justify-around items-center px-0.5 sm:px-2 py-2 sm:py-3 min-h-[75px] sm:min-h-[85px]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          const isTabLocked = isLocked && tab.value !== 'account' && tab.value !== 'overview';

          return (
            <button
              key={tab.value}
              onClick={() => !isTabLocked && onTabChange(tab.value)}
              disabled={isTabLocked}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 sm:gap-1 min-w-[44px] sm:min-w-[60px] py-1.5 sm:py-2 transition-all duration-300 relative flex-1",
                isActive ? "text-primary scale-110" : "text-muted-foreground/60",
                isTabLocked && "opacity-30 grayscale cursor-not-allowed",
                "max-w-[60px] sm:max-w-[70px]"
              )}
            >
              {isActive && (
                <div className="absolute -top-3 w-8 h-1 bg-primary rounded-full animate-in fade-in slide-in-from-top-1" />
              )}
              
              <div className={cn(
                "p-1.5 sm:p-2 rounded-xl transition-all duration-300",
                isActive && "bg-primary/10 shadow-inner"
              )}>
                <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", isActive ? "stroke-[2.5px]" : "stroke-[1.5px]")} />
              </div>
              
              <span className={cn(
                "text-[8px] sm:text-[9px] font-black uppercase tracking-tighter",
                isActive ? "opacity-100" : "opacity-70"
              )}>
                {tab.label}
              </span>
              
              {isTabLocked && (
                <div className="absolute top-2 right-2">
                  <Lock className="h-2 w-2 text-muted-foreground" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default DashboardMobileNav;
