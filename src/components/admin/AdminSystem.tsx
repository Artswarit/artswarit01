import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Server, Webhook, ShieldAlert, CreditCard } from "lucide-react";
import LogoLoader from "@/components/ui/LogoLoader";
import { useSystemHealth, useAuthSecurity } from "./hooks/useAdminMetrics";

export default function AdminSystem() {
  const { data, isLoading } = useSystemHealth();
  const { data: sec } = useAuthSecurity();

  if (isLoading || !data) return <div className="h-64 flex items-center justify-center"><LogoLoader text="Checking system health..." /></div>;

  const totalFn = data.functions.reduce((s, f) => s + f.ok + f.fail, 0);
  const totalFnFail = data.functions.reduce((s, f) => s + f.fail, 0);
  const subActive = data.subscriptions.active || 0;
  const subCancelled = (data.subscriptions.cancelled || 0) + (data.subscriptions.past_due || 0);

  const kpis = [
    { label: "Function Calls 24h", value: totalFn.toLocaleString(), sub: `${totalFnFail} failed`, icon: Server, color: "text-blue-600", bg: "bg-blue-500/10" },
    { label: "Webhooks 24h", value: `${data.webhookOk}/${data.webhookOk + data.webhookFail}`, sub: `${data.webhookFail} failed`, icon: Webhook, color: "text-purple-600", bg: "bg-purple-500/10" },
    { label: "Suspicious Logins 24h", value: sec?.suspicious ?? 0, sub: `${sec?.sessions24h ?? 0} sessions`, icon: ShieldAlert, color: "text-red-600", bg: "bg-red-500/10" },
    { label: "Active Subscriptions", value: subActive, sub: `${subCancelled} inactive`, icon: CreditCard, color: "text-emerald-600", bg: "bg-emerald-500/10" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((c) => (
          <Card key={c.label} className="border shadow-none sm:shadow-sm rounded-2xl sm:rounded-3xl bg-card">
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-6 pb-1 sm:pb-2">
              <CardTitle className="text-[9px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground">{c.label}</CardTitle>
              <div className={`p-1.5 sm:p-2 rounded-lg ${c.bg}`}><c.icon className={`h-3 w-3 sm:h-4 sm:w-4 ${c.color}`} /></div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-lg sm:text-2xl font-black">{c.value}</div>
              <p className="text-[9px] text-muted-foreground mt-0.5">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-3xl sm:rounded-[2rem] border shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" /> Edge Function Health
          </CardTitle>
          <CardDescription className="text-[10px] sm:text-sm">Last 24 hours, by function</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!data.functions.length ? (
            <p className="p-6 text-sm text-muted-foreground text-center">No function activity in the last 24h</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Function</TableHead>
                  <TableHead className="text-right">Success</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.functions.map((f) => {
                  const total = f.ok + f.fail;
                  const rate = total ? Math.round((f.ok / total) * 100) : 100;
                  return (
                    <TableRow key={f.name}>
                      <TableCell className="font-medium text-xs">{f.name}</TableCell>
                      <TableCell className="text-right text-xs">{f.ok}</TableCell>
                      <TableCell className="text-right text-xs">{f.fail}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={rate >= 95 ? "outline" : "destructive"} className="text-[10px]">{rate}%</Badge>
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
