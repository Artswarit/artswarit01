import { useOverviewKpis } from "../hooks/useAdminOverview";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface CardProps {
  title: string;
  value: string;
  hint?: string;
  hintTone?: "pos" | "neg" | "warn" | "muted";
  accent?: string; // tailwind bg class for the corner chip
  loading?: boolean;
}

function Card({ title, value, hint, hintTone = "muted", accent = "bg-primary/15", loading }: CardProps) {
  const toneClass = {
    pos: "text-emerald-600 dark:text-emerald-400",
    neg: "text-rose-600 dark:text-rose-400",
    warn: "text-rose-600 dark:text-rose-400 font-semibold",
    muted: "text-muted-foreground",
  }[hintTone];

  return (
    <div className="relative rounded-2xl border bg-card p-5 flex flex-col gap-3 hover:shadow-sm transition">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <span className={cn("h-6 w-6 rounded-md", accent)} />
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className="text-2xl sm:text-3xl font-semibold tracking-tight">{value}</div>
      )}
      {hint && (
        <div className="text-[11px]">
          <span className={cn("font-semibold", toneClass)}>{hint.split(" ")[0]}</span>{" "}
          <span className="text-muted-foreground">{hint.split(" ").slice(1).join(" ")}</span>
        </div>
      )}
    </div>
  );
}

const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

export default function OverviewKpis() {
  const { data, isLoading } = useOverviewKpis();
  const { format } = useCurrencyFormat();

  const k = data;
  const loading = isLoading || !k;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      <Card loading={loading} title="Platform revenue"
        value={k ? format(k.revenue.value) : "—"}
        hint={k ? `${fmtPct(k.revenue.delta)} vs last month` : undefined}
        hintTone={k && k.revenue.delta >= 0 ? "pos" : "neg"}
        accent="bg-violet-500/15" />
      <Card loading={loading} title="Gross marketplace value"
        value={k ? format(k.gmv.value) : "—"}
        hint={k ? `${fmtPct(k.gmv.delta)} vs last month` : undefined}
        hintTone={k && k.gmv.delta >= 0 ? "pos" : "neg"}
        accent="bg-blue-500/15" />
      <Card loading={loading} title="Escrow balance"
        value={k ? format(k.escrow.value) : "—"}
        hint="funded milestones"
        accent="bg-amber-500/15" />
      <Card loading={loading} title="Active projects"
        value={k ? k.activeProjects.toLocaleString() : "—"}
        hint="in progress / pending"
        accent="bg-emerald-500/15" />
      <Card loading={loading} title="Active artists"
        value={k ? k.activeArtists.toLocaleString() : "—"}
        hint="active last 30 days"
        accent="bg-pink-500/15" />
      <Card loading={loading} title="Active clients"
        value={k ? k.activeClients.toLocaleString() : "—"}
        hint="active last 30 days"
        accent="bg-cyan-500/15" />
      <Card loading={loading} title="Pending withdrawals"
        value={k ? format(k.pendingWithdrawals.amount) : "—"}
        hint={k ? `${k.pendingWithdrawals.count} requests` : undefined}
        accent="bg-orange-500/15" />
      <Card loading={loading} title="Pending disputes"
        value={k ? String(k.pendingDisputes.count) : "—"}
        hint={k && k.pendingDisputes.urgent > 0 ? `${k.pendingDisputes.urgent} urgent needs attention` : "no urgent items"}
        hintTone={k && k.pendingDisputes.urgent > 0 ? "warn" : "muted"}
        accent="bg-rose-500/15" />
      <Card loading={loading} title="Portfolio reviews"
        value={k ? String(k.portfolioReviews) : "—"}
        hint="awaiting approval"
        accent="bg-indigo-500/15" />
      <Card loading={loading} title="Pro subscribers"
        value={k ? k.proSubscribers.toLocaleString() : "—"}
        hint="active subscriptions"
        accent="bg-fuchsia-500/15" />
      <Card loading={loading} title="Platform health"
        value={k ? `${k.uptime.toFixed(2)}%` : "—"}
        hint="uptime last 24h"
        hintTone="pos"
        accent="bg-emerald-500/15" />
    </div>
  );
}
