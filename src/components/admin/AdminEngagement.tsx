import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Bell, Users, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import LogoLoader from "@/components/ui/LogoLoader";
import AdminFilters, { RangeKey } from "./AdminFilters";
import KpiCard from "./KpiCard";
import { useEngagementMetrics } from "./hooks/useAdminMetrics";

export default function AdminEngagement() {
  const [range, setRange] = useState<RangeKey>("30d");
  const { data, isLoading } = useEngagementMetrics(range);

  if (isLoading || !data) return <div className="h-64 flex items-center justify-center"><LogoLoader text="Loading engagement..." /></div>;

  const fmt = (n: number) => n.toLocaleString();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-end"><AdminFilters range={range} onChange={setRange} /></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="DAU" value={fmt(data.dau)} icon={Activity} />
        <KpiCard label="WAU" value={fmt(data.wau)} icon={Users} />
        <KpiCard label="MAU" value={fmt(data.mau)} icon={Users} />
        <KpiCard label="Conversations" value={fmt(data.conversations)} icon={MessageSquare} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <Card className="rounded-xl border border-border/60 shadow-none">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" /> Messaging
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">Activity · {range}</p>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-semibold font-mono">{fmt(data.messages)}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">messages sent</span>
            </div>
            <div className="flex items-baseline gap-3 pt-3 border-t border-border/60">
              <span className="text-lg font-semibold font-mono text-muted-foreground">{fmt(data.conversations)}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">total conversations</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/60 shadow-none">
          <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" /> Notifications
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">{fmt(data.notifications)} sent · by type</p>
            </div>
          </CardHeader>
          <CardContent className="h-[220px] p-2 sm:p-5 pt-0">
            {data.notifByType.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No notifications</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.notifByType} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.08} />
                  <XAxis dataKey="type" fontSize={10} axisLine={false} tickLine={false} stroke="currentColor" opacity={0.5} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="currentColor" opacity={0.5} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 11, background: "hsl(var(--card))" }} />
                  <Bar dataKey="count" fill="hsl(var(--foreground))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
