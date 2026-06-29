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
    capture_pageview: "history_change", // SPA route changes
    capture_pageleave: true,
    autocapture: true,
    capture_performance: { web_vitals: true }, // LCP / INP / CLS / FCP / TTFB
    capture_exceptions: true, // unhandled JS errors + rejections
    persistence: "localStorage+cookie",
    loaded: (ph) => {
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
}

export function resetAnalytics() {
  if (!inited) return;
  posthog.reset();
}

// Typed registry of custom events from the Artswarit analytics spec.
// Add properties as you fire them — extra fields are allowed.
export type AnalyticsEvent =
  | "sign_up"
  | "login"
  | "profile_completed"
  | "portfolio_created"
  | "artwork_uploaded"
  | "service_created"
  | "artist_profile_viewed"
  | "artwork_viewed"
  | "search"
  | "filter_used"
  | "commission_requested"
  | "commission_accepted"
  | "escrow_created"
  | "milestone_created"
  | "milestone_delivered"
  | "revision_requested"
  | "project_completed"
  | "review_submitted"
  | "dispute_raised"
  | "dispute_resolved"
  | "refund_processed"
  | "subscription_upgraded"
  | "payment_success"
  | "payment_failed"
  | "message_sent"
  | "notification_clicked"
  | "error_occurred"
  | "pricing_viewed"
  | "upgrade_clicked"
  | "portfolio_viewed";

export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}) {
  if (!inited) return;
  posthog.capture(event, props);
}

export { posthog };
