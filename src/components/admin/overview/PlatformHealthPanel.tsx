import { usePlatformHealth } from "../hooks/useAdminOverview";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function PlatformHealthPanel() {
  const { data, isLoading } = usePlatformHealth();
  const dot = { operational: "bg-emerald-500", degraded: "bg-amber-500", down: "bg-rose-500" };
  const label = { operational: "Operational", degraded: "Degraded", down: "Down" };
  const labelClass = {
    operational: "text-muted-foreground",
    degraded: "text-amber-600 dark:text-amber-400",
    down: "text-rose-600 dark:text-rose-400",
  };

  return (
    <div className="rounded-2xl border bg-card p-5">
      <h3 className="font-semibold tracking-tight mb-4">Platform health</h3>
      {isLoading || !data ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      ) : (
        <ul className="divide-y">
          {data.map((r) => (
            <li key={r.key} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2.5">
                <span className={cn("h-2 w-2 rounded-full", dot[r.status])} />
                <span className="text-sm">{r.label}</span>
              </div>
              <span className={cn("text-xs font-medium", labelClass[r.status])} title={r.note}>
                {label[r.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
