import React, { useCallback, useEffect, useState } from "react";
import { Wallet, Clock3, Briefcase, MessageSquare, ArrowRight, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { StatTile } from "@/components/dashboard/ui/StatTile";
import { SectionHeading } from "@/components/dashboard/ui/SectionHeading";
import { format as formatDate } from "date-fns";

interface ActiveProject {
  id: string;
  title: string;
  progress: number;
  deadline: string | null;
  budget: number | null;
  amount_usd: number | null;
  currency: string | null;
}

interface ArtistHomeSummaryProps {
  isLoading: boolean;
  onNavigate: (tab: string) => void;
}

/**
 * A single-glance snapshot for the Home tab: what's earned, what's owed,
 * what's actively in flight, and what needs a reply. Deliberately shallow —
 * the full breakdown lives in Account > Earnings and Projects so Home
 * doesn't duplicate those pages.
 */
const ArtistHomeSummary = ({ isLoading, onNavigate }: ArtistHomeSummaryProps) => {
  const { user } = useAuth();
  const { formatPrice, convertPrice, userCurrency } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [pendingEarnings, setPendingEarnings] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeProjects, setActiveProjects] = useState<ActiveProject[]>([]);
  const [activeProjectCount, setActiveProjectCount] = useState(0);

  const fetchSummary = useCallback(async (signal?: AbortSignal) => {
    if (!user?.id) return;

    try {
      const [transactionsRes, paymentsRes, projectsRes, convosRes] = await Promise.all([
        supabase.from('transactions').select('amount, status').eq('seller_id', user.id).abortSignal(signal),
        supabase.from('payments').select('amount, artist_payout, currency, status').eq('artist_id', user.id).abortSignal(signal),
        supabase.from('projects').select('id, title, progress, deadline, budget, amount_usd, currency').eq('artist_id', user.id).eq('status', 'accepted').order('deadline', { ascending: true, nullsFirst: false }).abortSignal(signal),
        supabase.from('conversations').select('id').eq('artist_id', user.id).abortSignal(signal),
      ]);

      const isAbortError = (error: any) =>
        error?.name === 'AbortError' || error?.message?.includes('signal is aborted');

      if (transactionsRes.error && !isAbortError(transactionsRes.error)) throw transactionsRes.error;
      if (paymentsRes.error && !isAbortError(paymentsRes.error)) throw paymentsRes.error;
      if (projectsRes.error && !isAbortError(projectsRes.error)) throw projectsRes.error;
      if (convosRes.error && !isAbortError(convosRes.error)) throw convosRes.error;

      let total = 0;
      let pending = 0;
      (transactionsRes.data || []).forEach((t: any) => {
        const value = convertPrice(Number(t.amount), t.currency || 'USD');
        if (t.status === 'success' || t.status === 'completed') total += value;
        else if (t.status === 'pending') pending += value;
      });
      (paymentsRes.data || []).forEach((p: any) => {
        const value = convertPrice(Number(p.artist_payout || p.amount), p.currency || 'USD');
        if (p.status === 'success' || p.status === 'completed') total += value;
        else if (p.status === 'pending') pending += value;
      });

      setTotalEarnings(total);
      setPendingEarnings(pending);

      const projects = projectsRes.data || [];
      setActiveProjectCount(projects.length);
      setActiveProjects(projects.slice(0, 3));

      const convoIds = (convosRes.data || []).map((c: any) => c.id);
      if (convoIds.length > 0) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', convoIds)
          .neq('sender_id', user.id)
          .eq('is_read', false)
          .abortSignal(signal);
        setUnreadCount(count || 0);
      } else {
        setUnreadCount(0);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('signal is aborted')) return;
      console.error('Error fetching home summary:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, convertPrice]);

  useEffect(() => {
    const controller = new AbortController();
    fetchSummary(controller.signal);
    return () => controller.abort();
  }, [fetchSummary]);

  if (isLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[110px] bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
        <div className="h-48 bg-muted animate-pulse rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatTile
          label="Total Earnings"
          value={formatPrice(totalEarnings, userCurrency)}
          hint="Lifetime revenue"
          icon={Wallet}
          tone="success"
          onClick={() => onNavigate('account')}
          actionLabel="View earnings breakdown"
        />
        <StatTile
          label="Pending Payouts"
          value={formatPrice(pendingEarnings, userCurrency)}
          hint="Processing"
          icon={Clock3}
          tone="warning"
          onClick={() => onNavigate('account')}
          actionLabel="View pending payouts"
        />
        <StatTile
          label="Active Projects"
          value={activeProjectCount}
          hint={activeProjectCount === 1 ? "In progress" : "In progress"}
          icon={Briefcase}
          tone="primary"
          onClick={() => onNavigate('projects')}
          actionLabel="View active projects"
        />
        <StatTile
          label="Unread Messages"
          value={unreadCount}
          hint={unreadCount > 0 ? "Needs a reply" : "All caught up"}
          icon={MessageSquare}
          tone={unreadCount > 0 ? "info" : "neutral"}
          onClick={() => onNavigate('messages')}
          actionLabel="View messages"
        />
      </div>

      <div className="space-y-4">
        <SectionHeading
          title="Active Work"
          description="Projects currently in progress that need your attention."
          size="sm"
          actions={
            activeProjectCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => onNavigate('projects')} className="font-semibold text-primary hover:bg-primary/5 rounded-xl">
                View All <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : undefined
          }
        />

        {activeProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 rounded-3xl border-2 border-dashed border-border/40 bg-muted/5">
            <div className="p-4 rounded-full bg-muted/20">
              <ImageOff className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <div className="space-y-1 max-w-xs">
              <p className="font-semibold">No active projects right now</p>
              <p className="text-sm text-muted-foreground">New client projects will show up here once accepted.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4">
            {activeProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => onNavigate('projects')}
                className="group text-left p-4 sm:p-5 rounded-2xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-token-sm transition-all duration-300 ease-apple"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm sm:text-base truncate group-hover:text-primary transition-colors">{project.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {project.deadline && (
                        <span>Due {formatDate(new Date(project.deadline), 'MMM d, yyyy')}</span>
                      )}
                      {(project.amount_usd ?? project.budget) != null && (
                        <span>
                          {project.amount_usd != null
                            ? formatPrice(Number(project.amount_usd), 'USD')
                            : formatPrice(Number(project.budget), project.currency || 'USD')}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-primary shrink-0">{project.progress ?? 0}%</span>
                </div>
                <Progress value={project.progress ?? 0} className="h-1.5 mt-3 rounded-full bg-muted/30" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ArtistHomeSummary;
