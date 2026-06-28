import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: { value: string; tone: "positive" | "negative" | "warn" | "neutral" };
  icon?: LucideIcon;
  className?: string;
}

const toneClass: Record<NonNullable<KpiCardProps["delta"]>["tone"], string> = {
  positive: "text-emerald-600",
  negative: "text-red-600",
  warn: "text-amber-600",
  neutral: "text-muted-foreground",
};

export default function KpiCard({ label, value, delta, icon: Icon, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        "p-4 sm:p-5 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-colors",
        className
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider leading-tight">
          {label}
        </p>
        {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" /> : null}
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight font-mono">
          {value}
        </span>
        {delta ? (
          <span className={cn("text-[10px] font-medium", toneClass[delta.tone])}>
            {delta.value}
          </span>
        ) : null}
      </div>
    </div>
  );
}
