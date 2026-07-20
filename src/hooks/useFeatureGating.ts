import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useArtistPlan, PLANS } from "./useArtistPlan";

export interface FeatureLimits {
  portfolioCount: number;
  portfolioLimit: number;
  canUploadPortfolio: boolean;
  portfolioRemaining: number;
  
  serviceCount: number;
  serviceLimit: number;
  canAddService: boolean;
  servicesRemaining: number;
  
  isProArtist: boolean;
  showUpgradePrompt: boolean;
}

export const useFeatureGating = (userId: string | undefined | null) => {
  const { plan, isProArtist, portfolioLimit, serviceLimit, loading: planLoading, refetch: refetchPlan } = useArtistPlan(userId);
  const [portfolioCount, setPortfolioCount] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCounts = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Fetch portfolio (artworks) count
    const { count: artworkCount, error: artError } = await supabase
      .from("artworks")
      .select("*", { count: "exact", head: true })
      .eq("artist_id", userId);

    // Fetch services count
    const { count: servicesCount, error: svcError } = await supabase
      .from("artist_services")
      .select("*", { count: "exact", head: true })
      .eq("artist_id", userId);

    if (artError) console.error("[useFeatureGating] Artworks count error:", artError);
    if (svcError) console.error("[useFeatureGating] Services count error:", svcError);

    setPortfolioCount(artworkCount || 0);
    setServiceCount(servicesCount || 0);
    setLoading(false);
  };

  const refresh = async () => {
    await Promise.all([
      fetchCounts(),
      refetchPlan()
    ]);
  };

  useEffect(() => {
    setLoading(true);
    fetchCounts();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    // Listen to both tables in a single channel
    const channel = supabase
      .channel(`gating-updates-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'artworks',
          filter: `artist_id=eq.${userId}`
        },
        (payload) => {
          // Small delay to ensure DB consistency before re-fetching counts
          setTimeout(fetchCounts, 150);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'artist_services',
          filter: `artist_id=eq.${userId}`
        },
        (payload) => {
          // Small delay to ensure DB consistency before re-fetching counts
          setTimeout(fetchCounts, 150);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const canUploadPortfolio = isProArtist || portfolioCount < portfolioLimit;
  const canAddService = isProArtist || serviceCount < serviceLimit;
  const portfolioRemaining = isProArtist ? Infinity : Math.max(0, portfolioLimit - portfolioCount);
  const servicesRemaining = isProArtist ? Infinity : Math.max(0, serviceLimit - serviceCount);
  const showUpgradePrompt = !isProArtist && (portfolioCount >= portfolioLimit - 2 || serviceCount >= serviceLimit);

  const limits: FeatureLimits = {
    portfolioCount,
    portfolioLimit,
    canUploadPortfolio,
    portfolioRemaining,
    serviceCount,
    serviceLimit,
    canAddService,
    servicesRemaining,
    isProArtist,
    showUpgradePrompt
  };

  return {
    ...limits,
    loading: loading || planLoading,
    plan,
    refresh
  };
};
