import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "primary";

const toneMap: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  primary: "bg-primary/10 text-primary",
};

/**
 * Maps the platform's project / milestone status strings onto a tone so every
 * surface renders the same status with the same colour.
 */
export const statusTone = (status?: string): StatusTone => {
  const s = (status || "").toLowerCase();
  if (/(completed|paid|released|approved|success|active)/.test(s)) return "success";
  if (/(progress|submitted|review)/.test(s)) return "info";
  if (/(pending|awaiting|draft|hold)/.test(s)) return "warning";
  if (/(dispute|cancel|reject|fail|overdue)/.test(s)) return "danger";
  return "neutral";
};

export interface StatusPillProps {
  children: React.ReactNode;
  tone?: StatusTone;
  className?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({ children, tone = "neutral", className }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none",
      toneMap[tone],
      className,
    )}
  >
    {children}
  </span>
);

export default StatusPill;
