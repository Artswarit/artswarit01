import React, { useEffect, useState, useCallback } from "react";
import { TrendingUp, Calendar, Eye, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FollowersList } from "@/components/dashboard/FollowersList";
import { useRealtimeSync } from "@/lib/realtime-sync";
import { computeProfileCompletion } from "@/hooks/useProfileCompletion";
import PageHeader from "@/components/shared/PageHeader";
import StatTile from "@/components/dashboard/ui/StatTile";


interface DashboardHeaderProps {
  user?: any;
  profile?: any;
  title: string;
  subtitle: string;
}

type ArtistStats = {
  totalViews: number;
  monthlyEarnings: number;
  totalArtworks: number;
  followers: number;
};

const DashboardHeader = ({ user, profile, title, subtitle }: DashboardHeaderProps) => {
  const navigate = useNavigate();
  const { format } = useCurrencyFormat();
  const [artistStats, setArtistStats] = useState<ArtistStats>({
    totalViews: 0,
    monthlyEarnings: 0,
    totalArtworks: 0,
    followers: 0,
  });
  const [openFollowers, setOpenFollowers] = useState(false);
  const completion = computeProfileCompletion(profile);

  const fetchStats = useCallback(async (signal?: AbortSignal) => {
    if (!user?.id) return;
    
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    try {
      const [artworksCountRes, followersCountRes, earningsRes, monthlyEarningsRes, artworksViewsRes] =
        await Promise.all([
          supabase
            .from("artworks")
            .select("id", { count: "exact", head: true })
            .eq("artist_id", user.id)
            .abortSignal(signal),
          supabase
            .from("follows")
            .select("id", { count: "exact", head: true })
            .eq("following_id", user.id)
            .abortSignal(signal),
          supabase
            .from("transactions")
            .select("amount")
            .eq("seller_id", user.id)
            .eq("status", "success")
            .abortSignal(signal),
          supabase
            .from("transactions")
            .select("amount")
            .eq("seller_id", user.id)
            .eq("status", "success")
            .gte("created_at", monthStart.toISOString())
            .abortSignal(signal),
          supabase
            .from("artworks")
            .select("metadata")
            .eq("artist_id", user.id)
            .abortSignal(signal),
        ]);

      const isAbortError = (error: any) => 
        error?.name === 'AbortError' || 
        error?.message === 'AbortError: signal is aborted without reason' ||
        error?.message?.includes('Fetch aborted') ||
        error?.message?.includes('signal is aborted');

      if (
        (artworksCountRes.error && !isAbortError(artworksCountRes.error)) ||
        (followersCountRes.error && !isAbortError(followersCountRes.error)) ||
        (earningsRes.error && !isAbortError(earningsRes.error)) ||
        (monthlyEarningsRes.error && !isAbortError(monthlyEarningsRes.error)) ||
        (artworksViewsRes.error && !isAbortError(artworksViewsRes.error))
      ) {
        return;
      }

      const totalEarnings = (earningsRes.data ?? []).reduce(
        (sum, row) => sum + (Number(row.amount) || 0),
        0
      );
      const monthlyEarnings = (monthlyEarningsRes.data ?? []).reduce(
        (sum, row) => sum + (Number(row.amount) || 0),
        0
      );
      const totalViews = (artworksViewsRes.data ?? []).reduce((sum, row: any) => {
        const metadata = row?.metadata as any;
        const views = Number(metadata?.views_count ?? metadata?.views ?? metadata?.viewsCount ?? 0) || 0;
        return sum + views;
      }, 0);

      setArtistStats({
        totalViews,
        monthlyEarnings,
        totalArtworks: artworksCountRes.count ?? 0,
        followers: followersCountRes.count ?? 0,
      });
    } catch (err: any) {
      // Fetch error handled
    }
  }, [user?.id]);

  // Use Realtime Sync for multi-tab updates
  useRealtimeSync('all', fetchStats);

  useEffect(() => {
    if (!user?.id) return;

    const controller = new AbortController();
    fetchStats(controller.signal);

    const channel = supabase
      .channel(`artist-dashboard-stats:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "artworks", filter: `artist_id=eq.${user.id}` },
        () => fetchStats()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follows", filter: `following_id=eq.${user.id}` },
        () => fetchStats()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `seller_id=eq.${user.id}` },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      controller.abort();
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchStats]);

  const showEarnings =
    profile?.show_earnings ?? (profile?.social_links?.settings?.showEarnings ?? true);

  return (
    <div className="space-y-5 sm:space-y-6 pb-1">
      <PageHeader title={title} description={subtitle} size="lg" />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {profile && (
          <StatTile
            label="Profile"
            value={completion.isComplete ? "Verified" : "Incomplete"}
            hint={
              completion.isComplete
                ? "All set — you're discoverable"
                : `${completion.completionPercentage}% complete`
            }
            tone={completion.isComplete ? "success" : "warning"}
            iconSlot={
              <span className="text-[11px] font-semibold">{completion.completionPercentage}%</span>
            }
          />
        )}

        <StatTile
          label="Total views"
          value={artistStats.totalViews.toLocaleString()}
          hint="Across your portfolio"
          icon={Eye}
          tone="info"
        />

        {showEarnings && (
          <StatTile
            label="Earnings"
            value={format(artistStats.monthlyEarnings)}
            hint="This month"
            icon={TrendingUp}
            tone="success"
          />
        )}

        <StatTile
          label="Artworks"
          value={artistStats.totalArtworks}
          hint="Published pieces"
          icon={Calendar}
          tone="primary"
        />

        <StatTile
          label="Followers"
          value={artistStats.followers}
          hint="Tap to view list"
          icon={Users}
          tone="primary"
          onClick={() => setOpenFollowers(true)}
          actionLabel="View followers"
        />
      </div>

      <Dialog open={openFollowers} onOpenChange={setOpenFollowers}>
        <DialogContent className="max-w-2xl w-[95vw] sm:w-full p-4 sm:p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-semibold tracking-tight">Followers</DialogTitle>
            <DialogDescription className="text-sm">
              People following your work on Artswarit.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            <FollowersList />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};


export default DashboardHeader;
