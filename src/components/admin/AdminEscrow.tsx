import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import RetryableError from "@/components/shared/RetryableError";
import EmptyState from "@/components/shared/EmptyState";
import { Wallet } from "lucide-react";

interface EscrowRow {
  id: string;
  title: string;
  status: string;
  amount: number | null;
  amount_paid: number | null;
  currency: string | null;
  updated_at: string;
  project_id: string;
}

const HELD_STATUSES = ["WAITING_FUNDS", "ACTIVE", "REVIEW_PENDING", "REVISION_REQUESTED", "DISPUTED"];

export default function AdminEscrow() {
  const [rows, setRows] = useState<EscrowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("project_milestones")
      .select("id, title, status, amount, amount_paid, currency, updated_at, project_id")
      .in("status", HELD_STATUSES)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (err) setError(err.message);
    else setRows((data as unknown as EscrowRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalHeld = rows.reduce((sum, r) => sum + Number(r.amount_paid ?? 0), 0);

  if (error) return <RetryableError title="Couldn't load escrow" description={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Funds held in escrow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums">
            {loading ? <Skeleton className="h-8 w-32" /> : `$${totalHeld.toLocaleString()}`}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{rows.length} milestone(s) with funds not yet released</p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Escrow ledger</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Wallet} title="No escrow balances" description="No milestones currently hold client funds." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Milestone</th>
                    <th className="text-left font-medium px-4 py-2">Status</th>
                    <th className="text-right font-medium px-4 py-2">Amount</th>
                    <th className="text-right font-medium px-4 py-2">Funded</th>
                    <th className="text-right font-medium px-4 py-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium">{r.title}</td>
                      <td className="px-4 py-2.5"><Badge variant="secondary">{r.status}</Badge></td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{Number(r.amount ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{Number(r.amount_paid ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        {new Date(r.updated_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
