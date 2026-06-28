import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, AlertTriangle, Wallet } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import LogoLoader from "@/components/ui/LogoLoader";
import AdminFilters, { RangeKey } from "./AdminFilters";
import { usePaymentsSummary, useFailedPayments, useWithdrawalsSummary } from "./hooks/useAdminMetrics";

export default function AdminRevenue() {
  const [range, setRange] = useState<RangeKey>("30d");
  const { data: pay, isLoading } = usePaymentsSummary(range);
  const { data: failed } = useFailedPayments();
  const { data: wd } = useWithdrawalsSummary();

  if (isLoading || !pay) return <div className="h-64 flex items-center justify-center"><LogoLoader text="Loading revenue..." /></div>;

  const fmt = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const kpis = [
    { label: "GMV", value: fmt(pay.gmv), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Net Revenue", value: fmt(pay.fees), icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-500/10" },
    { label: "Failed Payments", value: pay.failedCount, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-500/10" },
    { label: "Withdrawals (paid)", value: fmt(wd?.total || 0), icon: Wallet, color: "text-purple-600", bg: "bg-purple-500/10" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-end"><AdminFilters range={range} onChange={setRange} /></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((c) => (
          <Card key={c.label} className="border shadow-none sm:shadow-sm rounded-2xl sm:rounded-3xl bg-card">
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-6 pb-1 sm:pb-2">
              <CardTitle className="text-[9px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground">{c.label}</CardTitle>
              <div className={`p-1.5 sm:p-2 rounded-lg ${c.bg}`}><c.icon className={`h-3 w-3 sm:h-4 sm:w-4 ${c.color}`} /></div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0"><div className="text-lg sm:text-2xl font-black">{c.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-3xl sm:rounded-[2rem] border shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg font-bold">Revenue Trend</CardTitle>
          <CardDescription className="text-[10px] sm:text-sm">Successful payments over the selected period</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] p-2 sm:p-6 pt-0">
          {pay.series.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No payments yet</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pay.series}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: 11 }} />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#rev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl sm:rounded-[2rem] border shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg font-bold">Recent Failed Payments</CardTitle>
          <CardDescription className="text-[10px] sm:text-sm">Last 20 failures</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!failed?.length ? (
            <p className="p-6 text-sm text-muted-foreground text-center">No failed payments 🎉</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failed.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-bold text-xs">${Number(p.amount).toLocaleString()} {p.currency}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{p.payment_method || "—"}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">{p.error_message || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</TableCell>
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
