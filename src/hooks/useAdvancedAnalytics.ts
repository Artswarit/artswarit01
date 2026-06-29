import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AdvancedAnalytics {
  days: number;
  trend: Array<{ day: string; views: number }>;
  totals: Record<string, number>;
  sources: Array<{ source: string; count: number }>;
}

export const useAdvancedAnalytics = (
  artistId: string | undefined | null,
  enabled: boolean,
  days = 30,
) => {
  const [data, setData] = useState<AdvancedAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!artistId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: fnError } = await supabase.functions.invoke(
        "posthog-insights",
        { body: { artist_id: artistId, days } },
      );
      if (fnError) throw fnError;
      if ((res as any)?.error) throw new Error((res as any).error);
      setData(res as AdvancedAnalytics);
    } catch (err) {
      setError((err as Error).message ?? "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [artistId, enabled, days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};
