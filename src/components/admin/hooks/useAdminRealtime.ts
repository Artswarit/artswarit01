import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Only the tables that MUST feel instant on the admin overview stay wired to
// Realtime. Lower-signal tables (artworks, projects, project_milestones,
// subscribers, admin_audit_logs, milestone_submissions) are refreshed via
// react-query's polling / invalidation on tab focus instead — they don't
// justify a persistent postgres_changes stream each admin page open.
const TABLES = [
  "payments",
  "withdrawals",
  "disputes",
] as const;

/**
 * Subscribes to write events on all tables that feed the admin overview and
 * invalidates every admin-scoped react-query key on any change.
 */
export function useAdminRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase.channel("admin-overview-live");
    TABLES.forEach((t) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table: t }, () => {
        qc.invalidateQueries({ queryKey: ["admin"] });
      });
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
