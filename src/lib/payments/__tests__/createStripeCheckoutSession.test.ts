import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createStripeCheckoutSession,
  StripeCheckoutTimeoutError,
} from '../createStripeCheckoutSession';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
    },
  },
}));

const ORIGINAL_FETCH = global.fetch;

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
});

afterEach(() => {
  vi.unstubAllEnvs();
  global.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe('createStripeCheckoutSession', () => {
  it('returns the checkout url on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://stripe/checkout/cs_123' }),
    }) as unknown as typeof fetch;

    const result = await createStripeCheckoutSession({ artworkId: 'a1' });
    expect(result).toEqual({ url: 'https://stripe/checkout/cs_123' });
  });

  it('throws a clear error when the response is missing url', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    await expect(createStripeCheckoutSession({ artworkId: 'a1' })).rejects.toThrow(
      /did not return a checkout URL/i,
    );
  });

  it('surfaces edge function error messages on non-OK response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    }) as unknown as typeof fetch;

    await expect(createStripeCheckoutSession({ artworkId: 'a1' })).rejects.toThrow(/boom/);
  });

  it('throws a timeout error when the request exceeds timeoutMs', async () => {
    // fetch never resolves — only the AbortController can end it.
    global.fetch = vi.fn().mockImplementation((_url, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }) as unknown as typeof fetch;

    await expect(
      createStripeCheckoutSession({ artworkId: 'a1' }, { timeoutMs: 25 }),
    ).rejects.toBeInstanceOf(StripeCheckoutTimeoutError);
  });

  it('aborts when an external signal is triggered', async () => {
    global.fetch = vi.fn().mockImplementation((_url, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }) as unknown as typeof fetch;

    const controller = new AbortController();
    const promise = createStripeCheckoutSession(
      { artworkId: 'a1' },
      { signal: controller.signal, timeoutMs: 60_000 },
    );
    controller.abort();
    await expect(promise).rejects.toThrow();
  });

  it('wraps generic network failures with a retry hint', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;
    await expect(createStripeCheckoutSession({ artworkId: 'a1' })).rejects.toThrow(
      /Could not reach payment service.*try again/i,
    );
  });
});
