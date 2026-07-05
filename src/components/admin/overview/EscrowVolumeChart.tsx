import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useEscrowVolume } from "../hooks/useAdminOverview";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Skeleton } from "@/components/ui/skeleton";

export default function EscrowVolumeChart() {
  const { data, isLoading } = useEscrowVolume();
  const { format } = useCurrencyFormat();
  return (
    <div className="rounded-2xl border bg-card p-5">
      <h3 className="font-semibold tracking-tight">Escrow volume</h3>
      <p className="text-xs text-muted-foreground mb-4">Held vs. released, monthly</p>
      <div className="h-56">
        {isLoading || !data ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                formatter={(v: number) => format(v)}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
              <Bar dataKey="held" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="released" fill="hsl(var(--primary) / 0.35)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
