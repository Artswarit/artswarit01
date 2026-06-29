import { useEffect, useRef } from "react";
import { trackOncePerSession, type AnalyticsEvent } from "@/lib/analytics";

interface Options {
  /** Stable id of the item being shown (artist_id / artwork_id / service_id). */
  id: string | undefined;
  /** PostHog event to fire. */
  event: AnalyticsEvent;
  /** Extra properties merged into the event (position, query, etc). */
  props?: Record<string, unknown>;
  /** Threshold for IntersectionObserver. Default 0.5 = 50% visible. */
  threshold?: number;
  /** Skip tracking entirely (e.g. while data is loading). */
  disabled?: boolean;
}

/**
 * Fires `event` exactly once per session when the attached element becomes
 * visible in the viewport. Backed by IntersectionObserver + sessionStorage
 * dedupe so a user scrolling up and down only counts each impression once.
 *
 * Usage:
 *   const ref = useImpressionTracker({ id, event: "artwork_impression", props: { position, query } });
 *   return <div ref={ref}>...</div>;
 */
export function useImpressionTracker<T extends HTMLElement = HTMLDivElement>(
  options: Options,
) {
  const ref = useRef<T | null>(null);
  const { id, event, props, threshold = 0.5, disabled } = options;

  useEffect(() => {
    if (disabled || !id || !ref.current || typeof IntersectionObserver === "undefined") {
      return;
    }
    const node = ref.current;
    const key = `imp:${event}:${id}`;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            trackOncePerSession(key, event, { id, ...(props ?? {}) });
            observer.disconnect();
            break;
          }
        }
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // props intentionally not deep-tracked — impressions only need to fire once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, event, threshold, disabled]);

  return ref;
}
