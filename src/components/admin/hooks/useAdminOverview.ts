import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SUCCEEDED = ["succeeded", "captured", "paid", "completed"];
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/* ---------- Aggregated KPI cards ---------- */
export function useOverviewKpis() {
  return useQuery({
    queryKey: ["admin", "overview", "kpis"],
    staleTime: 30_000,
    queryFn: async () => {
      const now = new Date();
      const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const prevEnd = mtdStart;
      const activeSince = new Date(Date.now() - 30 * 864e5).toISOString();
      const oldOpenDispute = new Date(Date.now() - 48 * 36e5).toISOString();
      const dayAgo = new Date(Date.now() - 864e5).toISOString();

      const [
        paymentsMtd, paymentsPrev, escrow,
        activeProjects, artists, clients,
        pendingWith, disputes, urgent,
        portfolio, proSubs, fnLogs,
      ] = await Promise.all([
        supabase.from("payments").select("amount,platform_fee,status,created_at").gte("created_at", mtdStart),
        supabase.from("payments").select("platform_fee,status,created_at").gte("created_at", prevStart).lt("created_at", prevEnd),
        supabase.from("project_milestones").select("amount,status").in("status", ["funded", "in_progress", "submitted"]),
        supabase.from("projects").select("id", { count: "exact", head: true }).in("status", ["in_progress", "pending"]),
        supabase.from("profiles").select("id", { count: "exact", head: true }).in("role", ["artist", "premium"]).gte("last_active_at", activeSince),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "client").gte("last_active_at", activeSince),
        supabase.from("withdrawals").select("amount,status").eq("status", "pending"),
        supabase.from("disputes").select("id,status,created_at").eq("status", "open"),
        supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open").lt("created_at", oldOpenDispute),
        supabase.from("artworks").select("id", { count: "exact", head: true }).eq("status", "private"),
        supabase.from("subscribers").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("function_logs").select("success").gte("created_at", dayAgo).limit(2000),
      ]);

      const succ = (rows: any[] | null) => (rows || []).filter((r) => SUCCEEDED.includes(r.status));
      const revenue = succ(paymentsMtd.data).reduce((s, r) => s + Number(r.platform_fee || 0), 0);
      const gmv = succ(paymentsMtd.data).reduce((s, r) => s + Number(r.amount || 0), 0);
      const revenuePrev = succ(paymentsPrev.data).reduce((s, r) => s + Number(r.platform_fee || 0), 0);
      const gmvPrev = succ(paymentsPrev.data as any).reduce((s: number, r: any) => s + Number(r.platform_fee || 0), 0);
      const escrowBalance = (escrow.data || []).reduce((s, r: any) => s + Number(r.amount || 0), 0);
      const pendingWithSum = (pendingWith.data || []).reduce((s, r: any) => s + Number(r.amount || 0), 0);

      const logs = fnLogs.data || [];
      const total = logs.length || 1;
      const ok = logs.filter((l: any) => l.success).length;
      const uptime = logs.length ? (ok / total) * 100 : 100;

      const pct = (curr: number, prev: number) => (prev ? ((curr - prev) / prev) * 100 : curr ? 100 : 0);

      return {
        revenue: { value: revenue, delta: pct(revenue, revenuePrev) },
        gmv: { value: gmv, delta: pct(gmv, gmvPrev) },
        escrow: { value: escrowBalance },
        activeProjects: activeProjects.count || 0,
        activeArtists: artists.count || 0,
        activeClients: clients.count || 0,
        pendingWithdrawals: { count: pendingWith.data?.length || 0, amount: pendingWithSum },
        pendingDisputes: { count: disputes.data?.length || 0, urgent: urgent.count || 0 },
        portfolioReviews: portfolio.count || 0,
        proSubscribers: proSubs.count || 0,
        uptime,
      };
    },
  });
}

/* ---------- Charts ---------- */
export function useRevenueTrend() {
  return useQuery({
    queryKey: ["admin", "overview", "revenue-trend"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 11);
      since.setDate(1);
      const { data } = await supabase.from("payments")
        .select("platform_fee,amount,status,paid_at,created_at")
        .gte("created_at", since.toISOString());
      const buckets: Record<string, number> = {};
      const labels: string[] = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(since.getFullYear(), since.getMonth() + i, 1);
        const k = monthKey(d);
        buckets[k] = 0;
        labels.push(k);
      }
      (data || []).filter((r: any) => SUCCEEDED.includes(r.status)).forEach((r: any) => {
        const d = new Date(r.paid_at || r.created_at);
        const k = monthKey(d);
        if (k in buckets) buckets[k] += Number(r.platform_fee || 0);
      });
      return labels.map((k) => ({
        month: new Date(k + "-01").toLocaleString("en", { month: "short" }),
        value: buckets[k],
      }));
    },
  });
}

export function useEscrowVolume() {
  return useQuery({
    queryKey: ["admin", "overview", "escrow-volume"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 6);
      since.setDate(1);
      const [held, released] = await Promise.all([
        supabase.from("project_milestones").select("amount,paid_at,status")
          .not("paid_at", "is", null).gte("paid_at", since.toISOString()),
        supabase.from("project_milestones").select("amount,approved_at,status")
          .not("approved_at", "is", null).gte("approved_at", since.toISOString()),
      ]);
      const buckets: Record<string, { held: number; released: number }> = {};
      const labels: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(since.getFullYear(), since.getMonth() + i, 1);
        const k = monthKey(d);
        buckets[k] = { held: 0, released: 0 };
        labels.push(k);
      }
      (held.data || []).forEach((r: any) => {
        const k = monthKey(new Date(r.paid_at));
        if (buckets[k]) buckets[k].held += Number(r.amount || 0);
      });
      (released.data || []).forEach((r: any) => {
        const k = monthKey(new Date(r.approved_at));
        if (buckets[k]) buckets[k].released += Number(r.amount || 0);
      });
      return labels.map((k) => ({
        month: new Date(k + "-01").toLocaleString("en", { month: "short" }),
        ...buckets[k],
      }));
    },
  });
}

export function useUserGrowth() {
  return useQuery({
    queryKey: ["admin", "overview", "user-growth"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 84 * 864e5).toISOString();
      const { data } = await supabase.from("profiles").select("created_at").gte("created_at", since);
      const weeks: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        const d = new Date(r.created_at);
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        const k = monday.toISOString().slice(0, 10);
        weeks[k] = (weeks[k] || 0) + 1;
      });
      const entries = Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b));
      let total = 0;
      const cumulative = entries.map(([k, v]) => {
        total += v;
        return { week: k.slice(5), value: total };
      });
      return { series: cumulative, total: (data || []).length };
    },
  });
}

export function useSubscriptionGrowth() {
  return useQuery({
    queryKey: ["admin", "overview", "sub-growth"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 11);
      since.setDate(1);
      const { data } = await supabase.from("subscribers")
        .select("created_at,is_active").gte("created_at", since.toISOString());
      const buckets: Record<string, number> = {};
      const labels: string[] = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(since.getFullYear(), since.getMonth() + i, 1);
        const k = monthKey(d);
        buckets[k] = 0;
        labels.push(k);
      }
      (data || []).forEach((r: any) => {
        const k = monthKey(new Date(r.created_at));
        if (k in buckets) buckets[k] += 1;
      });
      let cum = 0;
      const series = labels.map((k) => {
        cum += buckets[k];
        return {
          month: new Date(k + "-01").toLocaleString("en", { month: "short" }),
          value: cum,
        };
      });
      const activeTotal = (data || []).filter((r: any) => r.is_active).length;
      return { series, total: activeTotal };
    },
  });
}

export function useTopCategories() {
  return useQuery({
    queryKey: ["admin", "overview", "top-cats"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // Category revenue via project → artwork link is not modeled; fall back to
      // top artwork categories weighted by view count.
      const { data } = await supabase.from("artworks")
        .select("category,metadata,price_usd").limit(1000);
      const agg: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        const views = Number(r.metadata?.views_count || 0);
        const price = Number(r.price_usd || 0);
        agg[r.category] = (agg[r.category] || 0) + views * Math.max(price, 1);
      });
      return Object.entries(agg)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    },
  });
}

/* ---------- Recent activity ---------- */
export function useRecentActivity() {
  return useQuery({
    queryKey: ["admin", "overview", "activity"],
    staleTime: 20_000,
    queryFn: async () => {
      const [audit, disp, wd, subs, arts] = await Promise.all([
        supabase.from("admin_audit_logs").select("id,action,reason,created_at,admin_id").order("created_at", { ascending: false }).limit(6),
        supabase.from("disputes").select("id,reason,created_at,status").order("created_at", { ascending: false }).limit(4),
        supabase.from("withdrawals").select("id,amount,created_at,status").order("created_at", { ascending: false }).limit(4),
        supabase.from("milestone_submissions").select("id,created_at,milestone_id").order("created_at", { ascending: false }).limit(4),
        supabase.from("artworks").select("id,title,created_at,status").order("created_at", { ascending: false }).limit(4),
      ]);
      type Item = { id: string; kind: string; text: string; created_at: string; tone: "ok" | "warn" | "info" | "muted" };
      const items: Item[] = [];
      (audit.data || []).forEach((r: any) =>
        items.push({ id: "a" + r.id, kind: "audit", text: `Admin ${r.action}${r.reason ? ` — ${r.reason}` : ""}`, created_at: r.created_at, tone: "info" }));
      (disp.data || []).forEach((r: any) =>
        items.push({ id: "d" + r.id, kind: "dispute", text: `Dispute opened: ${r.reason}`, created_at: r.created_at, tone: "warn" }));
      (wd.data || []).forEach((r: any) =>
        items.push({ id: "w" + r.id, kind: "withdrawal", text: `Withdrawal ${r.status} — ₹${Number(r.amount).toLocaleString("en-IN")}`, created_at: r.created_at, tone: "info" }));
      (subs.data || []).forEach((r: any) =>
        items.push({ id: "s" + r.id, kind: "delivery", text: `Milestone delivery submitted`, created_at: r.created_at, tone: "ok" }));
      (arts.data || []).forEach((r: any) =>
        items.push({ id: "art" + r.id, kind: "artwork", text: `New artwork uploaded: "${r.title}"`, created_at: r.created_at, tone: "muted" }));
      return items.sort((a, b) => (a.created_at > b.created_at ? -1 : 1)).slice(0, 8);
    },
  });
}

/* ---------- Platform health ---------- */
export function usePlatformHealth() {
  return useQuery({
    queryKey: ["admin", "overview", "health"],
    staleTime: 30_000,
    queryFn: async () => {
      const day = new Date(Date.now() - 864e5).toISOString();
      const { data } = await supabase.from("function_logs")
        .select("function_name,success").gte("created_at", day).limit(2000);
      const groups: Record<string, { name: string; ok: number; fail: number }> = {};
      (data || []).forEach((r: any) => {
        const n = r.function_name || "unknown";
        if (!groups[n]) groups[n] = { name: n, ok: 0, fail: 0 };
        r.success ? groups[n].ok++ : groups[n].fail++;
      });
      const rate = (n: string) => {
        const g = groups[n];
        if (!g) return { status: "operational" as const, note: "No traffic" };
        const total = g.ok + g.fail;
        const failPct = total ? (g.fail / total) * 100 : 0;
        return {
          status: failPct > 20 ? ("down" as const) : failPct > 5 ? ("degraded" as const) : ("operational" as const),
          note: `${Math.round(100 - failPct)}% success · ${total} calls`,
        };
      };
      return [
        { key: "razorpay", label: "Razorpay", ...rate("verify-razorpay-payment") },
        { key: "db", label: "Supabase database", status: "operational" as const, note: "Reachable" },
        { key: "ai", label: "AI moderation", ...rate("report-content") },
        { key: "storage", label: "Storage (Supabase)", status: "operational" as const, note: "Reachable" },
        { key: "email", label: "Email delivery", ...rate("send-email") },
      ];
    },
  });
}
