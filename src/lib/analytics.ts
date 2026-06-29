// PostHog analytics — Phase 1 instrumentation.
// Init in main.tsx, identify/reset in AuthContext, track() for custom events.
import posthog from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://us.i.posthog.com";

let inited = false;

export function initAnalytics() {
  if (inited || typeof window === "undefined" || !KEY) return;
  inited = true;
  posthog.init(KEY, {
    api_host: HOST,
    person_profiles: "identified_only",
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: true,
    capture_performance: { web_vitals: true },
    capture_exceptions: true,
    persistence: "localStorage+cookie",
    loaded: (ph) => {
      // Super-properties attached to every event — gives funnels a consistent
      // context object without each call-site having to repeat itself.
      ph.register({
        environment: import.meta.env.MODE,
        app: "artswarit-web",
      });
      if (import.meta.env.DEV) ph.debug(false);
    },
  });
}

export function identifyUser(
  userId: string,
  props: Record<string, unknown> = {},
) {
  if (!inited) return;
  posthog.identify(userId, props);
  // Promote user_id + role into super-properties so every subsequent event
  // — including ones fired from deep components — carries the user context.
  posthog.register({
    user_id: userId,
    user_role: (props as any).role ?? undefined,
  });
}

/** Add or overwrite super-properties attached to every future event. */
export function registerAnalyticsContext(props: Record<string, unknown>) {
  if (!inited) return;
  posthog.register(props);
}

export function resetAnalytics() {
  if (!inited) return;
  posthog.reset();
}

// Typed registry of custom events from the Artswarit analytics spec.
// Add properties as you fire them — extra fields are allowed.
export type AnalyticsEvent =
  // Auth / onboarding
  | "sign_up"
  | "login"
  | "profile_completed"
  // Portfolio
  | "portfolio_created"
  | "artwork_uploaded"
  | "service_created"
  | "artist_profile_viewed"
  | "artwork_viewed"
  | "portfolio_viewed"
  | "service_viewed"
  // Discovery / Search
  | "search"
  | "search_submitted"
  | "zero_results"
  | "search_results_loaded"
  | "search_result_clicked"
  | "filter_used"
  | "filter_applied"
  | "sort_changed"
  // Impressions
  | "artist_impression"
  | "service_impression"
  | "artwork_impression"
  // Marketplace engagement
  | "wishlist_added"
  | "wishlist_removed"
  | "artist_followed"
  | "artist_unfollowed"
  | "share_clicked"
  | "contact_artist_clicked"
  | "commission_started"
  // Commission funnel
  | "commission_requested"
  | "commission_accepted"
  | "escrow_created"
  | "milestone_created"
  | "milestone_delivered"
  | "revision_requested"
  | "project_completed"
  | "review_submitted"
  | "escrow_released"
  // Disputes
  | "dispute_raised"
  | "evidence_submitted"
  | "dispute_review_started"
  | "dispute_resolved"
  | "refund_processed"
  | "partial_refund_processed"
  | "escrow_released_after_dispute"
  // Payments
  | "payment_success"
  | "payment_failed"
  // Subscriptions
  | "pricing_viewed"
  | "upgrade_clicked"
  | "checkout_started"
  | "subscription_upgraded"
  | "subscription_renewed"
  | "subscription_cancelled"
  | "subscription_expired"
  // Engagement
  | "message_sent"
  | "notification_clicked"
  | "error_occurred";

export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}) {
  if (!inited) return;
  // Always stamp a client-side timestamp; PostHog also records its own.
  posthog.capture(event, { timestamp: new Date().toISOString(), ...props });
}

/**
 * Track once per session for a given key. Used for impressions and
 * de-duplicating expensive events like artist_profile_viewed on remount.
 */
const SESSION_KEY = "ph_session_dedupe_v1";
function dedupeStore(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}
function persistDedupe(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...set]));
  } catch {}
}
export function trackOncePerSession(
  key: string,
  event: AnalyticsEvent,
  props: Record<string, unknown> = {},
) {
  const set = dedupeStore();
  if (set.has(key)) return;
  set.add(key);
  persistDedupe(set);
  track(event, props);
}

export { posthog };

