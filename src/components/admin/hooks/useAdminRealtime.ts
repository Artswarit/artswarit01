import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TABLES = [
  "payments",
  "withdrawals",
  "disputes",
  "projects",
  "project_milestones",
  "subscribers",
  "artworks",
  "admin_audit_logs",
  "milestone_submissions",
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
