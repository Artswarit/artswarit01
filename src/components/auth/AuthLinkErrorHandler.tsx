// Supabase reports failed magic-link / verification / recovery links by
// appending an error to the URL hash of the redirect target, e.g.
//   /#error=access_denied&error_code=otp_expired&error_description=...
//
// The signup redirect target is `/`, and nothing there inspected the hash, so
// a user clicking an expired or already-used verification link landed on the
// homepage with no explanation and no way forward. ResetPassword handles this
// for recovery links; this covers every other entry point.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

/** Human-readable copy for the error codes Supabase actually emits here. */
function describe(errorCode: string | null, errorDescription: string | null): string {
  switch (errorCode) {
    case "otp_expired":
      return "That verification link has expired. Request a new one below.";
    case "access_denied":
      return "That link is no longer valid. It may have already been used.";
    default:
      // error_description arrives URL-encoded with + for spaces.
      return errorDescription
        ? decodeURIComponent(errorDescription.replace(/\+/g, " "))
        : "That link could not be verified. Request a new one below.";
  }
}

export function AuthLinkErrorHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes("error")) return;

    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const error = params.get("error");
    const errorCode = params.get("error_code");
    if (!error && !errorCode) return;

    // Recovery links are handled by ResetPassword's own flow; don't double-handle.
    if (params.get("type") === "recovery") return;

    toast.error("Link expired or already used", {
      description: describe(errorCode, params.get("error_description")),
      duration: 8000,
    });

    // Clear the hash so a refresh doesn't re-fire, then send the user somewhere
    // they can actually recover from instead of leaving them on the homepage.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    navigate("/verify-email", { replace: true });
  }, [navigate]);

  return null;
}
