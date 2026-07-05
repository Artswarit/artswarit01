import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useRevenueTrend, useOverviewKpis } from "../hooks/useAdminOverview";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Skeleton } from "@/components/ui/skeleton";

export default function RevenueTrendChart() {
  const { data, isLoading } = useRevenueTrend();
  const { data: kpis } = useOverviewKpis();
  const { format } = useCurrencyFormat();

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold tracking-tight">Revenue trend</h3>
          <p className="text-xs text-muted-foreground">Platform revenue, last 12 months</p>
        </div>
        {kpis && (
          <div className="text-right">
            <div className="font-semibold">{format(kpis.revenue.value)}</div>
            <div className={`text-xs font-semibold ${kpis.revenue.delta >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {kpis.revenue.delta >= 0 ? "+" : ""}{kpis.revenue.delta.toFixed(1)}%
            </div>
          </div>
        )}
      </div>
      <div className="h-56">
        {isLoading || !data ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                formatter={(v: number) => format(v)}
              />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
