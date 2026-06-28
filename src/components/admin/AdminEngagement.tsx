import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MessageSquare, Bell, Users, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import LogoLoader from "@/components/ui/LogoLoader";
import AdminFilters, { RangeKey } from "./AdminFilters";
import { useEngagementMetrics } from "./hooks/useAdminMetrics";

export default function AdminEngagement() {
  const [range, setRange] = useState<RangeKey>("30d");
  const { data, isLoading } = useEngagementMetrics(range);

  if (isLoading || !data) return <div className="h-64 flex items-center justify-center"><LogoLoader text="Loading engagement..." /></div>;

  const kpis = [
    { label: "DAU", value: data.dau, icon: Activity, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "WAU", value: data.wau, icon: Users, color: "text-blue-600", bg: "bg-blue-500/10" },
    { label: "MAU", value: data.mau, icon: Users, color: "text-purple-600", bg: "bg-purple-500/10" },
    { label: "Conversations", value: data.conversations, icon: MessageSquare, color: "text-amber-600", bg: "bg-amber-500/10" },
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
            <CardContent className="p-3 sm:p-6 pt-0"><div className="text-lg sm:text-2xl font-black">{c.value.toLocaleString()}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="rounded-3xl sm:rounded-[2rem] border shadow-sm">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> Messaging
            </CardTitle>
            <CardDescription className="text-[10px] sm:text-sm">Activity in the selected period</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black">{data.messages.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Messages sent</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-xl font-bold text-muted-foreground">{data.conversations.toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Total conversations</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl sm:rounded-[2rem] border shadow-sm">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" /> Notifications by Type
            </CardTitle>
            <CardDescription className="text-[10px] sm:text-sm">{data.notifications.toLocaleString()} total sent</CardDescription>
          </CardHeader>
          <CardContent className="h-[240px] p-2 sm:p-6 pt-0">
            {data.notifByType.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No notifications</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.notifByType}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                  <XAxis dataKey="type" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: 11 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
