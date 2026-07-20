// Server-side PostHog capture for webhook handlers.
// Requires POSTHOG_KEY env var. Override the host with POSTHOG_HOST if needed.

export type PHProps = Record<string, unknown>;

/**
 * Fire-and-forget PostHog capture. Never throws — webhook handlers must keep
 * processing the financial event even if analytics is degraded.
 */
export async function phCapture(
  event: string,
  distinctId: string,
  properties: PHProps = {},
): Promise<void> {
  try {
    const key = Deno.env.get("POSTHOG_KEY");
    const host = Deno.env.get("POSTHOG_HOST") || "https://us.i.posthog.com";
    if (!key || !distinctId) return;

    const env = Deno.env.get("ENVIRONMENT") ?? "production";
    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event,
        distinct_id: distinctId,
        properties: {
          source: "edge_function",
          environment: env,
          timestamp: new Date().toISOString(),
          ...properties,
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error("[posthog] capture failed", event, err);
  }
}

