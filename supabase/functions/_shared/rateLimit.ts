// Shared fixed-window rate limiter backed by public.check_rate_limit().
//
// Used by the AI proxy endpoints, which call paid third-party LLM APIs and are
// reachable without a JWT. Keep the failure mode "fail open": a limiter outage
// must not take down the feature, it just stops throttling.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds the caller should wait before retrying. */
  retryAfter: number;
}

/**
 * Derives a stable bucket key for the caller: the authenticated user when we
 * have one, otherwise the client IP from the proxy headers. Anonymous callers
 * behind a shared NAT will share a bucket, which is an acceptable trade for
 * protecting spend on a publicly reachable endpoint.
 */
export function callerBucketKey(req: Request, scope: string, userId?: string | null): string {
  if (userId) return `${scope}:user:${userId}`;

  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
  return `${scope}:ip:${ip}`;
}

export async function checkRateLimit(
  bucketKey: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Rate limiter not configured; allowing request");
    return { allowed: true, retryAfter: 0 };
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await admin.rpc("check_rate_limit", {
      _bucket_key: bucketKey,
      _max_requests: maxRequests,
      _window_seconds: windowSeconds,
    });

    if (error) {
      console.error("Rate limit check failed, allowing request:", error.message);
      return { allowed: true, retryAfter: 0 };
    }

    return { allowed: data !== false, retryAfter: windowSeconds };
  } catch (err) {
    console.error("Rate limit check threw, allowing request:", err);
    return { allowed: true, retryAfter: 0 };
  }
}

export function rateLimitResponse(retryAfter: number, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please wait a moment and try again.",
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    },
  );
}
