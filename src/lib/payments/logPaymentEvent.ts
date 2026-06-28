/**
 * Centralized payment logging.
 *
 * Wraps `console.error` / `console.warn` with a consistent structured payload
 * so failures can be filtered in production log streams or piped into an
 * analytics service later without changing every call site.
 *
 * IMPORTANT: never include card numbers, CVV, billing address, auth tokens,
 * or full request/response bodies. Only opaque IDs and outcome metadata.
 */

export type PaymentKind = 'artwork' | 'milestone' | 'premium' | 'unknown';

export type PaymentFailureReason =
  | 'timeout'
  | 'network'
  | 'http_error'
  | 'missing_url'
  | 'unexpected';

export interface PaymentFailureContext {
  kind: PaymentKind;
  /** Provider-agnostic id of the thing being paid for. */
  targetId?: string;
  /** Stripe | Razorpay | etc. */
  provider?: string;
  /** Wall-clock ms between request start and failure. */
  durationMs?: number;
  reason: PaymentFailureReason;
  /** Human-readable summary — must not contain card / token / address data. */
  message?: string;
  /** HTTP status (when applicable). */
  status?: number;
}

const SCOPE = '[payments]';

export function logPaymentFailure(ctx: PaymentFailureContext): void {
  // Strip undefined keys so logs stay readable.
  const payload: Record<string, unknown> = { scope: 'payments' };
  for (const [k, v] of Object.entries(ctx)) {
    if (v !== undefined) payload[k] = v;
  }
  console.error(SCOPE, payload);
}

export function logPaymentInfo(event: string, ctx: Partial<PaymentFailureContext> = {}): void {
  console.info(SCOPE, { scope: 'payments', event, ...ctx });
}
