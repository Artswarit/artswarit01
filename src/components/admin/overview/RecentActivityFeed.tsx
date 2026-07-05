import { useRecentActivity } from "../hooks/useAdminOverview";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minutes ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function RecentActivityFeed() {
  const { data, isLoading } = useRecentActivity();
  const dotFor = (tone: string) => ({
    ok: "bg-emerald-500",
    warn: "bg-rose-500",
    info: "bg-blue-500",
    muted: "bg-muted-foreground/50",
  }[tone] || "bg-muted-foreground/50");

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold tracking-tight">Recent activity</h3>
        <button className="text-xs text-primary font-medium hover:underline">View all</button>
      </div>
      {isLoading || !data ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : data.length === 0 ? (
        <p className="text-xs text-muted-foreground">No recent activity.</p>
      ) : (
        <ul className="space-y-3.5">
          {data.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              <span className={cn("h-1.5 w-1.5 rounded-full mt-1.5 shrink-0", dotFor(item.tone))} />
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{item.text}</p>
                <p className="text-[11px] text-muted-foreground">{timeAgo(item.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
