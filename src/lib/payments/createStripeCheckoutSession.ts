import { supabase } from '@/integrations/supabase/client';

export const STRIPE_CHECKOUT_TIMEOUT_MS = 45_000;

export class StripeCheckoutTimeoutError extends Error {
  constructor(message = 'Payment request timed out. Please try again.') {
    super(message);
    this.name = 'StripeCheckoutTimeoutError';
  }
}

export interface StripeCheckoutResult {
  url: string;
}

/**
 * Calls the `create-checkout-session` edge function with an AbortController-backed
 * timeout. Throws on timeout, network failure, non-OK responses, or a response
 * payload missing `url`. Callers are responsible for surfacing the error to the
 * user and resetting any in-flight UI state.
 *
 * The happy path is identical to the previous inline `fetch` — same endpoint,
 * same headers, same body shape — so production behavior is preserved.
 */
export async function createStripeCheckoutSession(
  body: Record<string, unknown>,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<StripeCheckoutResult> {
  const timeoutMs = options.timeoutMs ?? STRIPE_CHECKOUT_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Bridge an externally-supplied AbortSignal into our controller so callers
  // can cancel (e.g. on unmount) without losing the timeout behavior.
  const externalAbortHandler = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', externalAbortHandler);
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

    let response: Response;
    try {
      response = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        throw new StripeCheckoutTimeoutError();
      }
      const message = err instanceof Error ? err.message : 'Network error';
      throw new Error(`Could not reach payment service: ${message}. Please try again.`);
    }

    let data: { url?: string; error?: string } = {};
    try {
      data = await response.json();
    } catch {
      // fall through — handled below
    }

    if (!response.ok) {
      throw new Error(data.error || `Payment service returned ${response.status}. Please try again.`);
    }
    if (!data.url) {
      throw new Error(data.error || 'Payment service did not return a checkout URL. Please try again.');
    }
    return { url: data.url };
  } finally {
    clearTimeout(timeoutId);
    if (options.signal) options.signal.removeEventListener('abort', externalAbortHandler);
  }
}
