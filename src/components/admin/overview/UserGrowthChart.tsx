import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { useUserGrowth } from "../hooks/useAdminOverview";
import { Skeleton } from "@/components/ui/skeleton";

export default function UserGrowthChart() {
  const { data, isLoading } = useUserGrowth();
  return (
    <div className="rounded-2xl border bg-card p-5 flex flex-col">
      <h3 className="font-semibold tracking-tight">User growth</h3>
      <p className="text-xs text-muted-foreground">Artists + clients, cumulative</p>
      <div className="h-32 mt-3 -mx-2">
        {isLoading || !data ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <ResponsiveContainer>
            <LineChart data={data.series} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }} />
              <Line type="monotone" dataKey="value" stroke="hsl(217 91% 60%)" strokeWidth={2.2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      {data && (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-semibold">{data.total.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">last 12 weeks</span>
        </div>
      )}
    </div>
  );
}
