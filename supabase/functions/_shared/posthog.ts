// Server-side PostHog capture for webhook handlers.
// The project API key is publishable — safe to embed. Override with the
// POSTHOG_KEY / POSTHOG_HOST env vars if the project ever rotates keys.
const DEFAULT_KEY = "phc_DiWvXLe6jhHPib3VNvodaQyybusp44pR69B3Rrp2shTw";
const DEFAULT_HOST = "https://us.i.posthog.com";

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
    const key = Deno.env.get("POSTHOG_KEY") ?? DEFAULT_KEY;
    const host = Deno.env.get("POSTHOG_HOST") ?? DEFAULT_HOST;
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
