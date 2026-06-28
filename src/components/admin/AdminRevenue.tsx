import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, AlertTriangle, Wallet } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import LogoLoader from "@/components/ui/LogoLoader";
import AdminFilters, { RangeKey } from "./AdminFilters";
import KpiCard from "./KpiCard";
import { usePaymentsSummary, useFailedPayments, useWithdrawalsSummary } from "./hooks/useAdminMetrics";

export default function AdminRevenue() {
  const [range, setRange] = useState<RangeKey>("30d");
  const { data: pay, isLoading } = usePaymentsSummary(range);
  const { data: failed } = useFailedPayments();
  const { data: wd } = useWithdrawalsSummary();

  if (isLoading || !pay) return <div className="h-64 flex items-center justify-center"><LogoLoader text="Loading revenue..." /></div>;

  const fmt = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-end"><AdminFilters range={range} onChange={setRange} /></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="GMV" value={fmt(pay.gmv)} icon={DollarSign} delta={{ value: `${pay.succeededCount} paid`, tone: "positive" }} />
        <KpiCard label="Net Revenue" value={fmt(pay.fees)} icon={TrendingUp} />
        <KpiCard label="Failed Payments" value={pay.failedCount} icon={AlertTriangle} delta={pay.failedCount > 0 ? { value: "review", tone: "negative" } : undefined} />
        <KpiCard label="Withdrawals" value={fmt(wd?.total || 0)} icon={Wallet} delta={{ value: `${wd?.pending || 0} pending`, tone: "neutral" }} />
      </div>

      <Card className="rounded-xl border border-border/60 shadow-none">
        <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-sm font-semibold">Revenue Trend</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">Successful payments · {range}</p>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{range}</span>
        </CardHeader>
        <CardContent className="h-[280px] p-2 sm:p-5 pt-0">
          {pay.series.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No payments yet</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pay.series} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.08} />
                <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} stroke="currentColor" opacity={0.5} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="currentColor" opacity={0.5} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 11, background: "hsl(var(--card))" }} />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--foreground))" fill="url(#rev)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-border/60 shadow-none overflow-hidden">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-sm font-semibold">Recent Failed Payments</CardTitle>
          <p className="text-[11px] text-muted-foreground mt-0.5">Last 20 failures</p>
        </CardHeader>
        <CardContent className="p-0">
          {!failed?.length ? (
            <p className="p-6 text-xs text-muted-foreground text-center">No failed payments</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px]">Amount</TableHead>
                  <TableHead className="text-[11px]">Method</TableHead>
                  <TableHead className="text-[11px]">Reason</TableHead>
                  <TableHead className="text-[11px]">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failed.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs font-semibold">${Number(p.amount).toLocaleString()} <span className="text-muted-foreground font-normal">{p.currency}</span></TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] font-normal">{p.payment_method || "—"}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">{p.error_message || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{new Date(p.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
