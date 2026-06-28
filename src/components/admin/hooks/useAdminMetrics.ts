import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rangeToDate, type RangeKey } from "../AdminFilters";

// Generic count helper (status-based grouping returned client-side)
async function groupByStatus(table: string, column = "status") {
  const { data, error } = await (supabase as any).from(table).select(column);
  if (error) throw error;
  const counts: Record<string, number> = {};
  (data || []).forEach((row: any) => {
    const k = row[column] || "unknown";
    counts[k] = (counts[k] || 0) + 1;
  });
  return counts;
}

export function useProjectsBreakdown() {
  return useQuery({
    queryKey: ["admin", "projects-breakdown"],
    queryFn: () => groupByStatus("projects"),
    staleTime: 60_000,
  });
}

export function useMilestonesBreakdown() {
  return useQuery({
    queryKey: ["admin", "milestones-breakdown"],
    queryFn: () => groupByStatus("project_milestones"),
    staleTime: 60_000,
  });
}

export function useStuckProjects() {
  return useQuery({
    queryKey: ["admin", "stuck-projects"],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, status, updated_at, created_at")
        .eq("status", "in_progress")
        .lt("updated_at", cutoff)
        .order("updated_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });
}

export function usePaymentsSummary(range: RangeKey) {
  return useQuery({
    queryKey: ["admin", "payments-summary", range],
    queryFn: async () => {
      const since = rangeToDate(range).toISOString();
      const { data, error } = await supabase
        .from("payments")
        .select("amount, platform_fee, status, created_at, paid_at")
        .gte("created_at", since);
      if (error) throw error;
      const rows = data || [];
      const succeeded = rows.filter((r: any) => ["succeeded", "captured", "paid"].includes(r.status));
      const failed = rows.filter((r: any) => r.status === "failed");
      const pending = rows.filter((r: any) => ["pending", "created", "processing"].includes(r.status));
      const gmv = succeeded.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const fees = succeeded.reduce((s: number, r: any) => s + Number(r.platform_fee || 0), 0);

      // Daily series
      const byDay: Record<string, number> = {};
      succeeded.forEach((r: any) => {
        const d = (r.paid_at || r.created_at || "").slice(0, 10);
        if (!d) return;
        byDay[d] = (byDay[d] || 0) + Number(r.amount || 0);
      });
      const series = Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date: date.slice(5), value }));

      return {
        gmv,
        fees,
        succeededCount: succeeded.length,
        failedCount: failed.length,
        pendingCount: pending.length,
        series,
      };
    },
    staleTime: 60_000,
  });
}

export function useFailedPayments() {
  return useQuery({
    queryKey: ["admin", "failed-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, currency, status, error_message, payment_method, created_at, client_id, artist_id")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });
}

export function useWithdrawalsSummary() {
  return useQuery({
    queryKey: ["admin", "withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("withdrawals").select("amount, status");
      if (error) throw error;
      const counts = { pending: 0, paid: 0, failed: 0, total: 0 };
      (data || []).forEach((r: any) => {
        const s = r.status === "completed" ? "paid" : r.status;
        if (s in counts) counts[s as keyof typeof counts] += 1;
        if (s === "paid") counts.total += Number(r.amount || 0);
      });
      return counts;
    },
    staleTime: 60_000,
  });
}

export function useSignupTrend() {
  return useQuery({
    queryKey: ["admin", "signup-trend"],
    queryFn: async () => {
      const since = new Date(Date.now() - 84 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("profiles")
        .select("created_at, role")
        .gte("created_at", since);
      if (error) throw error;
      const weeks: Record<string, { week: string; artists: number; clients: number }> = {};
      (data || []).forEach((r: any) => {
        const d = new Date(r.created_at);
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        const key = monday.toISOString().slice(5, 10);
        if (!weeks[key]) weeks[key] = { week: key, artists: 0, clients: 0 };
        if (r.role === "artist" || r.role === "premium") weeks[key].artists += 1;
        else weeks[key].clients += 1;
      });
      return Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week));
    },
    staleTime: 5 * 60_000,
  });
}

export function useSecondaryKpis() {
  return useQuery({
    queryKey: ["admin", "secondary-kpis"],
    queryFn: async () => {
      const day = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [active, pendingArt, openReports, failedPay] = await Promise.all([
        supabase.from("login_sessions").select("user_id", { count: "exact", head: true }).gte("last_active_at", day),
        supabase.from("artworks").select("id", { count: "exact", head: true }).eq("status", "private"),
        supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", week),
      ]);
      return {
        active24h: active.count || 0,
        pendingArtworks: pendingArt.count || 0,
        openReports: openReports.count || 0,
        failedPayments7d: failedPay.count || 0,
      };
    },
    staleTime: 60_000,
  });
}

export function useRecentAudit() {
  return useQuery({
    queryKey: ["admin", "recent-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audit_logs")
        .select("id, action, target_id, reason, created_at, admin_id")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });
}

export function useTopArtworks(metric: "views_count" | "likes_count" = "views_count") {
  return useQuery({
    queryKey: ["admin", "top-artworks", metric],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artworks")
        .select("id, title, metadata, status, created_at")
        .limit(200);
      if (error) throw error;
      return (data || [])
        .map((a: any) => ({
          ...a,
          metricValue: Number(a.metadata?.[metric] || 0),
        }))
        .sort((a: any, b: any) => b.metricValue - a.metricValue)
        .slice(0, 10);
    },
    staleTime: 2 * 60_000,
  });
}

export function useContentKpis() {
  return useQuery({
    queryKey: ["admin", "content-kpis"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [todayCount, pending, reportedArt] = await Promise.all([
        supabase.from("artworks").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
        supabase.from("artworks").select("id", { count: "exact", head: true }).eq("status", "private"),
        supabase.from("reports").select("artwork_id", { count: "exact", head: true }).not("artwork_id", "is", null),
      ]);
      return {
        uploadsToday: todayCount.count || 0,
        pendingReview: pending.count || 0,
        reported: reportedArt.count || 0,
      };
    },
    staleTime: 60_000,
  });
}

export function useEngagementMetrics(range: RangeKey) {
  return useQuery({
    queryKey: ["admin", "engagement", range],
    queryFn: async () => {
      const since = rangeToDate(range).toISOString();
      const day = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const month = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [dau, wau, mau, msgRows, notifRows, convs] = await Promise.all([
        supabase.from("login_sessions").select("user_id").gte("last_active_at", day),
        supabase.from("login_sessions").select("user_id").gte("last_active_at", week),
        supabase.from("login_sessions").select("user_id").gte("last_active_at", month),
        supabase.from("messages").select("created_at").gte("created_at", since),
        supabase.from("notifications").select("type, created_at").gte("created_at", since),
        supabase.from("conversations").select("id", { count: "exact", head: true }),
      ]);

      const uniq = (rows: any) => new Set((rows.data || []).map((r: any) => r.user_id)).size;

      const notifByType: Record<string, number> = {};
      (notifRows.data || []).forEach((n: any) => {
        notifByType[n.type] = (notifByType[n.type] || 0) + 1;
      });

      return {
        dau: uniq(dau),
        wau: uniq(wau),
        mau: uniq(mau),
        messages: msgRows.data?.length || 0,
        notifications: notifRows.data?.length || 0,
        conversations: convs.count || 0,
        notifByType: Object.entries(notifByType).map(([type, count]) => ({ type, count })),
      };
    },
    staleTime: 60_000,
  });
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ["admin", "system-health"],
    queryFn: async () => {
      const day = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [fnLogs, webhooks, subs] = await Promise.all([
        supabase.from("function_logs").select("function_name, success").gte("created_at", day).limit(1000),
        supabase.from("webhook_logs").select("event_type, processed, error_message").gte("created_at", day).limit(500),
        supabase.from("subscriptions").select("status"),
      ]);

      const fnAgg: Record<string, { name: string; ok: number; fail: number }> = {};
      (fnLogs.data || []).forEach((r: any) => {
        const name = r.function_name || "unknown";
        if (!fnAgg[name]) fnAgg[name] = { name, ok: 0, fail: 0 };
        if (r.success) fnAgg[name].ok += 1;
        else fnAgg[name].fail += 1;
      });

      const webhookOk = (webhooks.data || []).filter((w: any) => w.processed && !w.error_message).length;
      const webhookFail = (webhooks.data || []).filter((w: any) => w.error_message || !w.processed).length;

      const subAgg: Record<string, number> = {};
      (subs.data || []).forEach((s: any) => {
        const k = s.status || "unknown";
        subAgg[k] = (subAgg[k] || 0) + 1;
      });

      return {
        functions: Object.values(fnAgg).sort((a, b) => b.ok + b.fail - (a.ok + a.fail)).slice(0, 15),
        webhookOk,
        webhookFail,
        subscriptions: subAgg,
      };
    },
    staleTime: 60_000,
  });
}

export function useAuthSecurity() {
  return useQuery({
    queryKey: ["admin", "auth-security"],
    queryFn: async () => {
      const day = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("login_sessions")
        .select("user_id, ip_address, created_at")
        .gte("created_at", day);
      if (error) throw error;
      const byUser: Record<string, Set<string>> = {};
      (data || []).forEach((r: any) => {
        if (!r.user_id) return;
        byUser[r.user_id] = byUser[r.user_id] || new Set();
        if (r.ip_address) byUser[r.user_id].add(r.ip_address);
      });
      const suspicious = Object.values(byUser).filter((s) => s.size >= 3).length;
      return {
        sessions24h: data?.length || 0,
        uniqueUsers: Object.keys(byUser).length,
        suspicious,
      };
    },
    staleTime: 60_000,
  });
}
