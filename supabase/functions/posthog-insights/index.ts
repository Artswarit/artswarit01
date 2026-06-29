// Pro-only PostHog analytics for the artist dashboard.
// Validates the caller via Supabase JWT, confirms an active Pro subscription,
// then runs HogQL queries against the project's PostHog workspace.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const POSTHOG_HOST = "https://us.posthog.com";

interface Body {
  artist_id?: string;
  days?: number;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function runHogQL(projectId: string, apiKey: string, query: string) {
  const res = await fetch(`${POSTHOG_HOST}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  // HogQL returns { results: [[col1, col2, ...], ...], columns: [...] }
  return {
    columns: data.columns ?? [],
    rows: data.results ?? [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    // Pro gate — check active subscription/role
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const [{ data: sub }, { data: profile }] = await Promise.all([
      admin
        .from("subscribers")
        .select("is_active, subscription_tier")
        .eq("user_id", userId)
        .maybeSingle(),
      admin.from("profiles").select("role").eq("id", userId).maybeSingle(),
    ]);
    const isPro =
      (sub?.is_active && sub?.subscription_tier) || profile?.role === "premium";
    if (!isPro) return json({ error: "Pro subscription required", locked: true }, 403);

    const body: Body = await req.json().catch(() => ({}));
    const artistId = body.artist_id ?? userId;
    const days = Math.min(Math.max(body.days ?? 30, 7), 90);

    const projectId = Deno.env.get("POSTHOG_PROJECT_ID");
    const apiKey = Deno.env.get("POSTHOG_PERSONAL_API_KEY");
    if (!projectId || !apiKey) {
      return json({ error: "PostHog not configured" }, 500);
    }

    const safeArtist = artistId.replace(/'/g, "''");
    const since = `now() - interval ${days} day`;

    const [trend, totals, sources] = await Promise.all([
      runHogQL(
        projectId,
        apiKey,
        `select toDate(timestamp) as day, count() as views
         from events
         where event = 'artist_profile_viewed'
           and properties.artist_id = '${safeArtist}'
           and timestamp >= ${since}
         group by day order by day`,
      ),
      runHogQL(
        projectId,
        apiKey,
        `select event, count() as c
         from events
         where properties.artist_id = '${safeArtist}'
           and timestamp >= ${since}
           and event in ('artist_profile_viewed','artwork_viewed','artwork_liked','artist_followed','commission_requested')
         group by event`,
      ),
      runHogQL(
        projectId,
        apiKey,
        `select coalesce(properties.source, 'direct') as source, count() as c
         from events
         where event = 'artist_profile_viewed'
           and properties.artist_id = '${safeArtist}'
           and timestamp >= ${since}
         group by source order by c desc limit 5`,
      ),
    ]);

    return json({
      days,
      trend: trend.rows.map((r: unknown[]) => ({
        day: String(r[0]),
        views: Number(r[1] ?? 0),
      })),
      totals: Object.fromEntries(
        totals.rows.map((r: unknown[]) => [String(r[0]), Number(r[1] ?? 0)]),
      ),
      sources: sources.rows.map((r: unknown[]) => ({
        source: String(r[0]),
        count: Number(r[1] ?? 0),
      })),
    });
  } catch (err) {
    console.error("posthog-insights error", err);
    return json({ error: (err as Error).message }, 500);
  }
});
