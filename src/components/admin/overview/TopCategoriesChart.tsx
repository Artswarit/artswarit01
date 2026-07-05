import { useTopCategories } from "../hooks/useAdminOverview";
import { Skeleton } from "@/components/ui/skeleton";

export default function TopCategoriesChart() {
  const { data, isLoading } = useTopCategories();
  const max = Math.max(1, ...(data || []).map((d) => d.value));

  return (
    <div className="rounded-2xl border bg-card p-5">
      <h3 className="font-semibold tracking-tight mb-4">Top categories</h3>
      {isLoading || !data ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
        </div>
      ) : data.length === 0 ? (
        <p className="text-xs text-muted-foreground">No category data yet.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((d) => (
            <li key={d.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium truncate">{d.label}</span>
                <span className="text-muted-foreground tabular-nums">{Math.round(d.value).toLocaleString()}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(d.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
