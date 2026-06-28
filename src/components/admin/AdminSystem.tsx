import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Server, Webhook, ShieldAlert, CreditCard } from "lucide-react";
import LogoLoader from "@/components/ui/LogoLoader";
import KpiCard from "./KpiCard";
import { useSystemHealth, useAuthSecurity } from "./hooks/useAdminMetrics";

export default function AdminSystem() {
  const { data, isLoading } = useSystemHealth();
  const { data: sec } = useAuthSecurity();

  if (isLoading || !data) return <div className="h-64 flex items-center justify-center"><LogoLoader text="Checking system health..." /></div>;

  const totalFn = data.functions.reduce((s, f) => s + f.ok + f.fail, 0);
  const totalFnFail = data.functions.reduce((s, f) => s + f.fail, 0);
  const subActive = data.subscriptions.active || 0;
  const subCancelled = (data.subscriptions.cancelled || 0) + (data.subscriptions.past_due || 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="Function Calls 24h" value={totalFn.toLocaleString()} icon={Server} delta={{ value: `${totalFnFail} failed`, tone: totalFnFail > 0 ? "warn" : "positive" }} />
        <KpiCard label="Webhooks 24h" value={`${data.webhookOk}/${data.webhookOk + data.webhookFail}`} icon={Webhook} delta={{ value: `${data.webhookFail} failed`, tone: data.webhookFail > 0 ? "warn" : "positive" }} />
        <KpiCard label="Suspicious 24h" value={sec?.suspicious ?? 0} icon={ShieldAlert} delta={{ value: `${sec?.sessions24h ?? 0} sessions`, tone: (sec?.suspicious ?? 0) > 0 ? "negative" : "neutral" }} />
        <KpiCard label="Active Subs" value={subActive} icon={CreditCard} delta={{ value: `${subCancelled} inactive`, tone: "neutral" }} />
      </div>

      <Card className="rounded-xl border border-border/60 shadow-none overflow-hidden">
        <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" /> Edge Function Health
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">Last 24 hours · by function</p>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">24h</span>
        </CardHeader>
        <CardContent className="p-0">
          {!data.functions.length ? (
            <p className="p-6 text-xs text-muted-foreground text-center">No function activity in the last 24h</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px]">Function</TableHead>
                  <TableHead className="text-[11px] text-right">Success</TableHead>
                  <TableHead className="text-[11px] text-right">Failed</TableHead>
                  <TableHead className="text-[11px] text-right">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.functions.map((f) => {
                  const total = f.ok + f.fail;
                  const rate = total ? Math.round((f.ok / total) * 100) : 100;
                  return (
                    <TableRow key={f.name}>
                      <TableCell className="font-medium text-xs">{f.name}</TableCell>
                      <TableCell className="text-right text-xs font-mono">{f.ok}</TableCell>
                      <TableCell className="text-right text-xs font-mono">{f.fail}</TableCell>
                      <TableCell className="text-right">
                        <span className={`text-xs font-mono font-semibold ${rate >= 95 ? "text-emerald-600" : rate >= 80 ? "text-amber-600" : "text-red-600"}`}>{rate}%</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
