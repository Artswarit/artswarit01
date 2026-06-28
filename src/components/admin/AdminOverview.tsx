import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Image as ImageIcon, TrendingUp, Activity, FileWarning, Flag, XCircle, AlertCircle, ShieldCheck } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import LogoLoader from "@/components/ui/LogoLoader";
import KpiCard from "./KpiCard";
import { useSignupTrend, useSecondaryKpis, useRecentAudit } from "./hooks/useAdminMetrics";

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function auditTone(action: string): "ok" | "warn" | "muted" {
  const a = (action || "").toLowerCase();
  if (a.includes("ban") || a.includes("delete") || a.includes("warn") || a.includes("suspend")) return "warn";
  if (a.includes("approve") || a.includes("resolve") || a.includes("success")) return "ok";
  return "muted";
}

export default function AdminOverview() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { data: trend } = useSignupTrend();
  const { data: secondary } = useSecondaryKpis();
  const { data: audit } = useRecentAudit();

  useEffect(() => {
    async function fetchStats() {
      try {
        const [{ count: userCount }, { count: artistCount }, { count: artworkCount }, { count: projectCount }, { data: disputeData }] = await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "artist"),
          supabase.from("artworks").select("*", { count: "exact", head: true }),
          supabase.from("projects").select("*", { count: "exact", head: true }),
          supabase.from("disputes").select("status"),
        ]);
        const openDisputes = disputeData?.filter((d: any) => d.status === "open").length || 0;
        setStats({ users: userCount || 0, artists: artistCount || 0, artworks: artworkCount || 0, projects: projectCount || 0, openDisputes });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading || !stats) return <div className="h-64 flex items-center justify-center"><LogoLoader text="Loading metrics..." /></div>;

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      {/* Primary KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="Total Users" value={fmt(stats.users)} icon={Users} />
        <KpiCard label="Active Artists" value={fmt(stats.artists)} icon={TrendingUp} />
        <KpiCard label="Live Artworks" value={fmt(stats.artworks)} icon={ImageIcon} />
        <KpiCard label="Open Disputes" value={stats.openDisputes} icon={AlertCircle} delta={stats.openDisputes > 0 ? { value: "needs review", tone: "warn" } : undefined} />
      </div>

      {/* Secondary KPI strip */}
      <div className="flex gap-4 sm:gap-6 py-3 sm:py-4 border-y border-border/60 overflow-x-auto no-scrollbar">
        {[
          { label: "Active 24h", value: fmt(secondary?.active24h ?? 0), icon: Activity, tone: "text-emerald-600" },
          { label: "Unpublished", value: fmt(secondary?.pendingArtworks ?? 0), icon: FileWarning, tone: "text-foreground" },
          { label: "Open Reports", value: fmt(secondary?.openReports ?? 0), icon: Flag, tone: (secondary?.openReports ?? 0) > 0 ? "text-amber-600" : "text-foreground" },
          { label: "Failed Pay 7d", value: fmt(secondary?.failedPayments7d ?? 0), icon: XCircle, tone: (secondary?.failedPayments7d ?? 0) > 0 ? "text-red-600" : "text-foreground" },
        ].map((s) => (
          <div key={s.label} className="flex flex-col min-w-[100px] shrink-0">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <s.icon className="h-3 w-3" /> {s.label}
            </span>
            <span className={`text-sm font-semibold font-mono mt-0.5 ${s.tone}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <Card className="lg:col-span-2 rounded-xl border border-border/60 shadow-none">
          <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-semibold">Signup Growth</CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">Artists vs Clients · last 12 weeks</p>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">12W</span>
          </CardHeader>
          <CardContent className="h-[260px] p-2 sm:p-5 pt-0">
            {!trend?.length ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Not enough signup data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.08} />
                  <XAxis dataKey="week" fontSize={10} axisLine={false} tickLine={false} stroke="currentColor" opacity={0.5} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="currentColor" opacity={0.5} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 11, background: "hsl(var(--card))" }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
                  <Line type="monotone" dataKey="artists" stroke="hsl(var(--foreground))" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="clients" stroke="#10b981" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/60 shadow-none">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Platform Stability
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">Escrow & dispute snapshot</p>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-5">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Projects</p>
              <p className="text-2xl font-semibold font-mono mt-1">{fmt(stats.projects)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/60">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Healthy</p>
                <p className="text-sm font-semibold font-mono text-emerald-600 mt-0.5">{fmt(Math.max(0, stats.projects - stats.openDisputes))}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Disputes</p>
                <p className={`text-sm font-semibold font-mono mt-0.5 ${stats.openDisputes > 0 ? "text-red-600" : "text-emerald-600"}`}>{fmt(stats.openDisputes)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audit feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold">System Audit</h3>
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">live feed</span>
        </div>
        <div className="space-y-2">
          {!audit?.length ? (
            <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl">
              No admin actions recorded yet
            </div>
          ) : audit.map((a: any) => {
            const tone = auditTone(a.action);
            return (
              <div key={a.id} className={`flex gap-3 p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors ${tone === "warn" ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}>
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                  tone === "ok" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                  tone === "warn" ? "bg-amber-500" : "bg-muted-foreground/40"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{a.action}</p>
                  {a.reason ? <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{a.reason}</p> : null}
                  <p className="text-[10px] text-muted-foreground/70 font-mono mt-1">{formatRelative(a.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
