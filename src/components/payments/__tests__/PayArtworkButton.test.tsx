import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PayArtworkButton } from '@/components/payments/PayArtworkButton';

// ---- Module mocks ------------------------------------------------------------

const initiatePayment = vi.fn();
vi.mock('@/hooks/useRazorpay', () => ({
  useRazorpay: () => ({ initiatePayment, loading: false }),
}));

vi.mock('@/hooks/useCurrencyFormat', () => ({
  useCurrencyFormat: () => ({ format: (n: number) => `$${n}` }),
}));

const gatewayState = { provider: 'stripe' as 'stripe' | 'razorpay' };
vi.mock('@/hooks/usePaymentGateway', () => ({
  usePaymentGateway: () => ({
    formatGatewayAmount: (n: number) => `$${n}`,
    gatewayCurrency: 'USD',
    isIndian: false,
    get provider() {
      return gatewayState.provider;
    },
  }),
}));

vi.mock('@/components/payments/PaymentMethodBadge', () => ({
  PaymentMethodBadge: () => null,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const createStripeCheckoutSession = vi.fn();
vi.mock('@/lib/payments/createStripeCheckoutSession', () => ({
  createStripeCheckoutSession: (...args: unknown[]) => createStripeCheckoutSession(...args),
  StripeCheckoutTimeoutError: class extends Error {},
}));

// ---- Test setup --------------------------------------------------------------

// Prevent jsdom "navigation not implemented" noise; capture the redirect.
const navigations: string[] = [];
beforeEach(() => {
  navigations.length = 0;
  gatewayState.provider = 'stripe';
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: new Proxy(
      { href: 'http://localhost/' },
      {
        set(target, prop, value) {
          if (prop === 'href') navigations.push(value);
          (target as Record<string, unknown>)[prop as string] = value;
          return true;
        },
      },
    ),
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

async function openConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /unlock artwork/i }));
  return screen.getByRole('button', { name: /confirm purchase/i });
}

describe('PayArtworkButton — Stripe flow', () => {
  it('prevents duplicate submissions while a request is in flight', async () => {
    let resolveCheckout: (v: { url: string }) => void = () => {};
    createStripeCheckoutSession.mockImplementation(
      () => new Promise((res) => { resolveCheckout = res; }),
    );

    const user = userEvent.setup();
    render(<PayArtworkButton artworkId="a1" amount={50} artworkTitle="Sunset" />);
    const confirm = await openConfirm(user);

    await user.click(confirm);
    // Rapid second click while the first is in flight.
    await user.click(confirm);
    await user.click(confirm);

    expect(createStripeCheckoutSession).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();

    resolveCheckout({ url: 'https://stripe/cs_ok' });
    await waitFor(() => expect(navigations).toContain('https://stripe/cs_ok'));
  });

  it('keeps the dialog open and disables close affordances during the request', async () => {
    let resolveCheckout: (v: { url: string }) => void = () => {};
    createStripeCheckoutSession.mockImplementation(
      () => new Promise((res) => { resolveCheckout = res; }),
    );

    const user = userEvent.setup();
    render(<PayArtworkButton artworkId="a1" amount={50} artworkTitle="Sunset" />);
    const confirm = await openConfirm(user);
    await user.click(confirm);

    const dialog = await screen.findByRole('dialog');
    const discard = screen.getByRole('button', { name: /discard/i });
    expect(discard).toBeDisabled();

    // Escape should not dismiss the dialog while processing.
    await user.keyboard('{Escape}');
    expect(dialog).toBeInTheDocument();

    resolveCheckout({ url: 'https://stripe/cs_ok' });
    await waitFor(() => expect(navigations).toContain('https://stripe/cs_ok'));
  });

  it('navigates to the Stripe URL on success (happy path unchanged)', async () => {
    createStripeCheckoutSession.mockResolvedValue({ url: 'https://stripe/cs_ok' });

    const user = userEvent.setup();
    render(<PayArtworkButton artworkId="a1" amount={50} artworkTitle="Sunset" />);
    const confirm = await openConfirm(user);
    await user.click(confirm);

    await waitFor(() => expect(navigations).toEqual(['https://stripe/cs_ok']));
    expect(createStripeCheckoutSession).toHaveBeenCalledWith(
      { artworkId: 'a1' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('restores normal state and surfaces a retry message after a generic failure', async () => {
    createStripeCheckoutSession.mockRejectedValueOnce(new Error('Payment service is down'));

    const user = userEvent.setup();
    render(<PayArtworkButton artworkId="a1" amount={50} artworkTitle="Sunset" />);
    const confirm = await openConfirm(user);
    await user.click(confirm);

    const errorAlert = await screen.findByTestId('stripe-error');
    expect(errorAlert).toHaveTextContent(/Payment service is down/);
    expect(errorAlert).toHaveTextContent(/try again/i);

    // Dialog is now re-enabled.
    const retry = screen.getByRole('button', { name: /retry payment/i });
    expect(retry).toBeEnabled();
    expect(screen.getByRole('button', { name: /discard/i })).toBeEnabled();
  });

  it('restores normal state after a timeout failure', async () => {
    createStripeCheckoutSession.mockRejectedValueOnce(
      Object.assign(new Error('Payment request timed out. Please try again.'), {
        name: 'StripeCheckoutTimeoutError',
      }),
    );

    const user = userEvent.setup();
    render(<PayArtworkButton artworkId="a1" amount={50} artworkTitle="Sunset" />);
    const confirm = await openConfirm(user);
    await user.click(confirm);

    const errorAlert = await screen.findByTestId('stripe-error');
    expect(errorAlert).toHaveTextContent(/timed out/i);
    expect(screen.getByRole('button', { name: /retry payment/i })).toBeEnabled();
  });

  it('retries successfully after a prior failure', async () => {
    createStripeCheckoutSession
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce({ url: 'https://stripe/cs_retry' });

    const user = userEvent.setup();
    render(<PayArtworkButton artworkId="a1" amount={50} artworkTitle="Sunset" />);
    const confirm = await openConfirm(user);

    await user.click(confirm);
    await screen.findByTestId('stripe-error');

    const retry = screen.getByRole('button', { name: /retry payment/i });
    await user.click(retry);

    await waitFor(() => expect(navigations).toEqual(['https://stripe/cs_retry']));
    expect(createStripeCheckoutSession).toHaveBeenCalledTimes(2);
    // Same artwork context preserved on the retry.
    expect(createStripeCheckoutSession).toHaveBeenNthCalledWith(
      2,
      { artworkId: 'a1' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
