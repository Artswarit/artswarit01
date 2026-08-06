import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supa() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export default defineTool({
  name: "list_artworks",
  title: "List artworks",
  description:
    "List public artworks on Artswarit. Optionally filter by artist id, category, or search text.",
  inputSchema: {
    artist_id: z.string().uuid().optional().describe("Filter by artist id."),
    category: z.string().optional().describe("Filter by category."),
    query: z.string().optional().describe("Search title/description."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 12)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ artist_id, category, query, limit }) => {
    let q = supa()
      .from("artworks")
      .select("id, title, description, category, price, media_url, artist_id, created_at, status")
      .eq("status", "public")
      .order("created_at", { ascending: false })
      .limit(limit ?? 12);
    if (artist_id) q = q.eq("artist_id", artist_id);
    if (category) q = q.eq("category", category);
    if (query) {
      const like = `%${query}%`;
      q = q.or(`title.ilike.${like},description.ilike.${like}`);
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { artworks: data ?? [] },
    };
  },
});
