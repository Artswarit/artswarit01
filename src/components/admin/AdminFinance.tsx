import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Banknote, ArrowDownToLine, CheckCircle2, XCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import KpiCard from "./KpiCard";
import { cn } from "@/lib/utils";

type PaymentRow = {
  id: string;
  amount: number;
  platform_fee: number | null;
  artist_payout: number | null;
  currency: string | null;
  status: string;
  payment_method: string | null;
  client_id: string;
  artist_id: string;
  project_id: string | null;
  created_at: string;
};

type WithdrawalRow = {
  id: string;
  user_id: string;
  amount: number;
  payment_method: string | null;
  status: string;
  processed_at: string | null;
  created_at: string;
};

const statusTone = (s: string) => {
  const v = s.toLowerCase();
  if (["success", "approved", "completed", "paid"].includes(v)) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  if (["pending", "processing", "review"].includes(v)) return "bg-amber-500/10 text-amber-600 border-amber-500/20";
  if (["failed", "rejected", "cancelled"].includes(v)) return "bg-red-500/10 text-red-600 border-red-500/20";
  return "bg-muted text-muted-foreground border-border";
};

export default function AdminFinance() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"payments" | "withdrawals">("payments");
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [p, w] = await Promise.all([
      supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    if (p.data) setPayments(p.data as PaymentRow[]);
    if (w.data) setWithdrawals(w.data as WithdrawalRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const kpis = useMemo(() => {
    const gross = payments.filter(p => p.status === "success").reduce((a, b) => a + Number(b.amount || 0), 0);
    const fees = payments.filter(p => p.status === "success").reduce((a, b) => a + Number(b.platform_fee || 0), 0);
    const pendingW = withdrawals.filter(w => w.status === "pending").length;
    const paidW = withdrawals.filter(w => ["approved", "completed", "paid"].includes(w.status)).reduce((a, b) => a + Number(b.amount || 0), 0);
    return { gross, fees, pendingW, paidW };
  }, [payments, withdrawals]);

  const updateWithdrawal = async (id: string, status: "approved" | "rejected") => {
    setActing(id);
    const { error } = await supabase
      .from("withdrawals")
      .update({ status, processed_at: new Date().toISOString() })
      .eq("id", id);
    setActing(null);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Withdrawal ${status}`, description: `Marked ${id.slice(0, 8)} as ${status}.` });
    setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status, processed_at: new Date().toISOString() } : w));
  };

  const filteredPayments = payments.filter(p =>
    !search || p.id.includes(search) || p.razorpay_payment_id?.toString().includes(search) || p.client_id.includes(search) || p.artist_id.includes(search)
  );
  const filteredWithdrawals = withdrawals.filter(w =>
    !search || w.id.includes(search) || w.user_id.includes(search)
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Gross Payments" value={`$${kpis.gross.toFixed(0)}`} icon={Banknote} />
        <KpiCard label="Platform Fees" value={`$${kpis.fees.toFixed(0)}`} delta={{ value: "earned", tone: "positive" }} />
        <KpiCard label="Pending Withdrawals" value={kpis.pendingW} delta={{ value: "awaiting review", tone: kpis.pendingW > 0 ? "warn" : "neutral" }} icon={ArrowDownToLine} />
        <KpiCard label="Paid Out" value={`$${kpis.paidW.toFixed(0)}`} />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex p-1 bg-muted/50 rounded-full">
          {(["payments", "withdrawals"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-1.5 text-xs font-medium rounded-full capitalize transition-all ease-apple",
                tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : tab === "payments" ? (
        <div className="border border-border/60 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left p-3 font-medium uppercase tracking-wider text-[10px]">ID</th>
                  <th className="text-left p-3 font-medium uppercase tracking-wider text-[10px]">Amount</th>
                  <th className="text-left p-3 font-medium uppercase tracking-wider text-[10px]">Fee</th>
                  <th className="text-left p-3 font-medium uppercase tracking-wider text-[10px]">Payout</th>
                  <th className="text-left p-3 font-medium uppercase tracking-wider text-[10px]">Status</th>
                  <th className="text-left p-3 font-medium uppercase tracking-wider text-[10px]">Method</th>
                  <th className="text-left p-3 font-medium uppercase tracking-wider text-[10px]">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No payments found</td></tr>
                ) : filteredPayments.map(p => (
                  <tr key={p.id} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="p-3 font-mono text-[11px]">{p.id.slice(0, 8)}</td>
                    <td className="p-3 font-mono">${Number(p.amount).toFixed(2)}</td>
                    <td className="p-3 font-mono text-muted-foreground">${Number(p.platform_fee || 0).toFixed(2)}</td>
                    <td className="p-3 font-mono">${Number(p.artist_payout || 0).toFixed(2)}</td>
                    <td className="p-3"><Badge variant="outline" className={cn("text-[10px] font-medium border", statusTone(p.status))}>{p.status}</Badge></td>
                    <td className="p-3 text-muted-foreground">{p.payment_method || "—"}</td>
                    <td className="p-3 text-muted-foreground font-mono text-[10px]">{new Date(p.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="border border-border/60 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left p-3 font-medium uppercase tracking-wider text-[10px]">ID</th>
                  <th className="text-left p-3 font-medium uppercase tracking-wider text-[10px]">Artist</th>
                  <th className="text-left p-3 font-medium uppercase tracking-wider text-[10px]">Amount</th>
                  <th className="text-left p-3 font-medium uppercase tracking-wider text-[10px]">Method</th>
                  <th className="text-left p-3 font-medium uppercase tracking-wider text-[10px]">Status</th>
                  <th className="text-left p-3 font-medium uppercase tracking-wider text-[10px]">Requested</th>
                  <th className="text-right p-3 font-medium uppercase tracking-wider text-[10px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWithdrawals.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No withdrawals found</td></tr>
                ) : filteredWithdrawals.map(w => (
                  <tr key={w.id} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="p-3 font-mono text-[11px]">{w.id.slice(0, 8)}</td>
                    <td className="p-3 font-mono text-[11px] text-muted-foreground">{w.user_id.slice(0, 8)}</td>
                    <td className="p-3 font-mono">${Number(w.amount).toFixed(2)}</td>
                    <td className="p-3 text-muted-foreground">{w.payment_method || "—"}</td>
                    <td className="p-3"><Badge variant="outline" className={cn("text-[10px] font-medium border", statusTone(w.status))}>{w.status}</Badge></td>
                    <td className="p-3 text-muted-foreground font-mono text-[10px]">{new Date(w.created_at).toLocaleDateString()}</td>
                    <td className="p-3 text-right">
                      {w.status === "pending" ? (
                        <div className="inline-flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            disabled={acting === w.id}
                            onClick={() => updateWithdrawal(w.id, "approved")}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px] text-red-600 hover:text-red-700"
                            disabled={acting === w.id}
                            onClick={() => updateWithdrawal(w.id, "rejected")}
                          >
                            <XCircle className="h-3 w-3 mr-1" />Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {w.processed_at ? new Date(w.processed_at).toLocaleDateString() : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
