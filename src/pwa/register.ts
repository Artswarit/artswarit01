/**
 * PWA registration wrapper.
 *
 * Refuses to register the service worker in any non-production / preview /
 * iframe / kill-switch context, and proactively unregisters any existing
 * `/sw.js` registration in those contexts so stale workers from a previous
 * deploy can't keep serving cached HTML.
 *
 * Only registers when:
 *   - import.meta.env.PROD === true
 *   - not inside an iframe
 *   - hostname is NOT a Lovable preview/dev host
 *   - URL does NOT contain ?sw=off
 */

import { toast } from "sonner";

const PREVIEW_HOST_PREFIXES = ["id-preview--", "preview--"];
const PREVIEW_HOST_SUFFIXES = [
  "lovableproject.com",
  "lovableproject-dev.com",
  "beta.lovable.dev",
];
const PREVIEW_EXACT_HOSTS = new Set([
  "lovableproject.com",
  "lovableproject-dev.com",
  "beta.lovable.dev",
]);

function isPreviewHost(hostname: string): boolean {
  if (PREVIEW_EXACT_HOSTS.has(hostname)) return true;
  if (PREVIEW_HOST_PREFIXES.some((p) => hostname.startsWith(p))) return true;
  if (PREVIEW_HOST_SUFFIXES.some((s) => hostname.endsWith("." + s))) return true;
  return false;
}

function isRefusedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    // cross-origin iframe access throws → treat as iframe
    return true;
  }
  if (isPreviewHost(window.location.hostname)) return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get("sw") === "off") return true;
  return false;
}

async function unregisterAppWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          // Only target our app SW (not Firebase/OneSignal messaging workers)
          return /\/sw\.js(\?|$)/.test(url) || /\/service-worker\.js(\?|$)/.test(url);
        })
        .map((r) => r.unregister())
    );
  } catch {
    // ignore
  }
}

export async function registerPWA(): Promise<void> {
  if (isRefusedContext()) {
    await unregisterAppWorker();
    return;
  }

  try {
    const { registerSW } = await import("virtual:pwa-register");
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        toast("Update available", {
          description: "A new version of Artswarit is ready.",
          action: {
            label: "Reload",
            onClick: () => updateSW(true),
          },
          duration: Infinity,
        });
      },
      onRegisterError(error) {
        // eslint-disable-next-line no-console
        console.warn("[pwa] register error", error);
      },
    });
  } catch {
    // virtual module not available (e.g. dev) — no-op
  }
}
