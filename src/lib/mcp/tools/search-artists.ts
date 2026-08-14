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
  name: "search_artists",
  title: "Search artists",
  description:
    "Search Artswarit artists by keyword (matches name, city, bio). Returns approved, publicly visible artists only.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Search text: name, city, or skill."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }) => {
    const client = supa();
    const max = limit ?? 10;
    const like = `%${query}%`;
    const { data, error } = await client
      .from("public_profiles")
      .select("id, full_name, city, bio, avatar_url, role, tags")
      .or(
        `full_name.ilike.${like},city.ilike.${like},bio.ilike.${like}`,
      )
      .limit(max);

    if (error) {
      return { content: [{ type: "text", text: `Search failed: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { artists: data ?? [] },
    };
  },
});
