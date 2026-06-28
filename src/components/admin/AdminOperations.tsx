import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Clock, ListChecks, AlertOctagon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import LogoLoader from "@/components/ui/LogoLoader";
import AdminFilters, { RangeKey } from "./AdminFilters";
import KpiCard from "./KpiCard";
import { useProjectsBreakdown, useMilestonesBreakdown, useStuckProjects } from "./hooks/useAdminMetrics";

const COLORS = ["hsl(var(--foreground))", "#10b981", "#f59e0b", "#ef4444", "#6366f1", "#8b5cf6"];

export default function AdminOperations() {
  const [range, setRange] = useState<RangeKey>("30d");
  const { data: projects, isLoading: pl } = useProjectsBreakdown();
  const { data: milestones, isLoading: ml } = useMilestonesBreakdown();
  const { data: stuck, isLoading: sl } = useStuckProjects();

  if (pl || ml) return <div className="h-64 flex items-center justify-center"><LogoLoader text="Loading operations..." /></div>;

  const projectData = Object.entries(projects || {}).map(([name, value]) => ({ name, value }));
  const milestoneData = Object.entries(milestones || {}).map(([name, value]) => ({ name, value }));
  const totalProjects = projectData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-end"><AdminFilters range={range} onChange={setRange} /></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="Total Projects" value={totalProjects} icon={Briefcase} />
        <KpiCard label="In Progress" value={projects?.in_progress || 0} icon={Clock} />
        <KpiCard label="Completed" value={projects?.completed || 0} icon={ListChecks} delta={{ value: "lifetime", tone: "neutral" }} />
        <KpiCard label="Cancelled" value={projects?.cancelled || 0} icon={AlertOctagon} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <Card className="rounded-xl border border-border/60 shadow-none">
          <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-semibold">Projects by Status</CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">Lifecycle distribution</p>
            </div>
          </CardHeader>
          <CardContent className="h-[260px] p-2 sm:p-5 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={projectData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {projectData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 11, background: "hsl(var(--card))" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/60 shadow-none">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-sm font-semibold">Milestones by Status</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">Across all active projects</p>
          </CardHeader>
          <CardContent className="h-[260px] p-2 sm:p-5 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={milestoneData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.08} />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} stroke="currentColor" opacity={0.5} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="currentColor" opacity={0.5} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 11, background: "hsl(var(--card))" }} />
                <Bar dataKey="value" fill="hsl(var(--foreground))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border border-border/60 shadow-none overflow-hidden">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-red-500" /> Stuck Projects
          </CardTitle>
          <p className="text-[11px] text-muted-foreground mt-0.5">In-progress with no update in 14+ days</p>
        </CardHeader>
        <CardContent className="p-0">
          {sl ? <div className="p-6"><LogoLoader text="Loading..." /></div> : !stuck?.length ? (
            <p className="p-6 text-xs text-muted-foreground text-center">No stuck projects</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px]">Project</TableHead>
                  <TableHead className="text-[11px]">Status</TableHead>
                  <TableHead className="text-[11px]">Last Update</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stuck.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-xs">{p.title}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] font-normal">{p.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{new Date(p.updated_at).toLocaleDateString()}</TableCell>
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
