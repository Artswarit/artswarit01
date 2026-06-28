import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Clock, ListChecks, AlertOctagon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import LogoLoader from "@/components/ui/LogoLoader";
import AdminFilters, { RangeKey } from "./AdminFilters";
import { useProjectsBreakdown, useMilestonesBreakdown, useStuckProjects } from "./hooks/useAdminMetrics";

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#6366f1", "#8b5cf6"];

export default function AdminOperations() {
  const [range, setRange] = useState<RangeKey>("30d");
  const { data: projects, isLoading: pl } = useProjectsBreakdown();
  const { data: milestones, isLoading: ml } = useMilestonesBreakdown();
  const { data: stuck, isLoading: sl } = useStuckProjects();

  if (pl || ml) return <div className="h-64 flex items-center justify-center"><LogoLoader text="Loading operations..." /></div>;

  const projectData = Object.entries(projects || {}).map(([name, value]) => ({ name, value }));
  const milestoneData = Object.entries(milestones || {}).map(([name, value]) => ({ name, value }));
  const totalProjects = projectData.reduce((s, d) => s + d.value, 0);
  const completed = projects?.completed || 0;
  const inProgress = projects?.in_progress || 0;
  const cancelled = projects?.cancelled || 0;

  const kpis = [
    { label: "Total Projects", value: totalProjects, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-500/10" },
    { label: "In Progress", value: inProgress, icon: Clock, color: "text-amber-600", bg: "bg-amber-500/10" },
    { label: "Completed", value: completed, icon: ListChecks, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Cancelled", value: cancelled, icon: AlertOctagon, color: "text-red-600", bg: "bg-red-500/10" },
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="rounded-3xl sm:rounded-[2rem] border shadow-sm">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg font-bold">Projects by Status</CardTitle>
            <CardDescription className="text-[10px] sm:text-sm">Lifecycle distribution</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px] p-2 sm:p-6 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={projectData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {projectData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-3xl sm:rounded-[2rem] border shadow-sm">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg font-bold">Milestones by Status</CardTitle>
            <CardDescription className="text-[10px] sm:text-sm">Across all active projects</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px] p-2 sm:p-6 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={milestoneData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: 11 }} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl sm:rounded-[2rem] border shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-red-500" /> Stuck Projects
          </CardTitle>
          <CardDescription className="text-[10px] sm:text-sm">In-progress with no update in 14+ days</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {sl ? (
            <div className="p-6"><LogoLoader text="Loading..." /></div>
          ) : !stuck?.length ? (
            <p className="p-6 text-sm text-muted-foreground text-center">No stuck projects 🎉</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Update</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stuck.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-xs">{p.title}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{p.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(p.updated_at).toLocaleDateString()}</TableCell>
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
