// Listens for Stripe Checkout return URLs and fires a single payment_success /
// payment_failed event. We never fire payment_success before redirecting to
// Stripe — only after the success URL is reached, which means Stripe has
// actually completed the session. Webhooks update the DB independently; this
// hook is the client-side confirmation event used by funnels.
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { track } from "@/lib/analytics";

const SEEN_KEY = "ph_stripe_return_seen_v1";

function alreadySeen(key: string): boolean {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    const set: string[] = raw ? JSON.parse(raw) : [];
    if (set.includes(key)) return true;
    set.push(key);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(set.slice(-50)));
    return false;
  } catch {
    return false;
  }
}

export function StripeReturnTracker() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const artworkStatus = params.get("status"); // /artwork/:id?status=success
    const milestone = params.get("milestone"); // /artist-dashboard?milestone=success
    const premium = params.get("premium"); // /artist-dashboard?premium=success&plan=...
    const plan = params.get("plan");

    let fired = false;
    const dedupeKey = `${location.pathname}?${location.search}`;
    if (alreadySeen(dedupeKey)) return;

    if (artworkStatus === "success") {
      track("payment_success", {
        provider: "stripe",
        kind: "artwork",
        artwork_id: location.pathname.split("/artwork/")[1]?.split("?")[0] ?? null,
      });
      fired = true;
    } else if (artworkStatus === "cancel") {
      track("payment_failed", { provider: "stripe", kind: "artwork", reason: "cancelled" });
      fired = true;
    }

    if (milestone === "success") {
      track("payment_success", { provider: "stripe", kind: "milestone" });
      fired = true;
    } else if (milestone === "cancel") {
      track("payment_failed", { provider: "stripe", kind: "milestone", reason: "cancelled" });
      fired = true;
    }

    if (premium === "success") {
      track("subscription_upgraded", { provider: "stripe", plan });
      track("payment_success", { provider: "stripe", kind: "subscription", plan });
      fired = true;
    } else if (premium === "cancel") {
      track("payment_failed", { provider: "stripe", kind: "subscription", plan, reason: "cancelled" });
      fired = true;
    }

    if (fired) {
      // Strip the marker params from the URL so refreshes don't re-emit events.
      params.delete("status");
      params.delete("milestone");
      params.delete("premium");
      params.delete("plan");
      const search = params.toString();
      navigate(
        { pathname: location.pathname, search: search ? `?${search}` : "" },
        { replace: true },
      );
    }
  }, [location.pathname, location.search, navigate]);

  return null;
}
