import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Crown, Loader2, Lock, AlertCircle } from 'lucide-react';
import { useRazorpay } from '@/hooks/useRazorpay';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import { usePaymentGateway } from '@/hooks/usePaymentGateway';
import { PaymentMethodBadge } from '@/components/payments/PaymentMethodBadge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createStripeCheckoutSession } from '@/lib/payments/createStripeCheckoutSession';

interface PayArtworkButtonProps {
  artworkId: string;
  amount: number;
  artworkTitle: string;
  onSuccess?: () => void;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

export function PayArtworkButton({
  artworkId,
  amount,
  artworkTitle,
  onSuccess,
  className,
  variant = "default",
  size = "default"
}: PayArtworkButtonProps) {
  const { initiatePayment, loading } = useRazorpay();
  const { format: formatCurrency } = useCurrencyFormat();
  const { formatGatewayAmount, gatewayCurrency, provider } = usePaymentGateway();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [stripeProcessing, setStripeProcessing] = useState(false);

  const gatewayDisplayAmount = formatGatewayAmount(amount);

  const handlePayment = async () => {
    // Guard against rapid double-click / Enter-repeat re-firing the handler
    // before React commits the `disabled` re-render.
    if (stripeProcessing || loading) return;

    if (provider === 'stripe') {
      setStripeProcessing(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const response = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ artworkId }),
        });
        const data = await response.json();
        if (data.url) {
          // Leave stripeProcessing=true through the navigation so the button
          // stays disabled while the browser tears down the page.
          window.location.href = data.url;
          return;
        }
        throw new Error(data.error || 'Failed to create checkout session');
      } catch (err: any) {
        toast.error(err.message || 'Failed to initiate Stripe payment');
        setStripeProcessing(false);
      }
      return;
    }

    // Razorpay — close confirm dialog first so its backdrop doesn't block
    // the Razorpay overlay.
    setConfirmOpen(false);
    setTimeout(() => {
      initiatePayment({
        artworkId,
        onSuccess: () => {
          onSuccess?.();
        },
      });
    }, 350);
  };


  return (
    <>
      <Button
        size={size}
        variant={variant}
        className={className}
        onClick={() => setConfirmOpen(true)}
        disabled={loading || stripeProcessing}
      >
        {loading || stripeProcessing ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Crown className="h-4 w-4 mr-2" />
        )}
        Unlock Artwork ({gatewayDisplayAmount})
      </Button>

      <Dialog open={confirmOpen} onOpenChange={(v) => !stripeProcessing && setConfirmOpen(v)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Unlock Artwork</DialogTitle>
            <DialogDescription className="text-base font-medium">
              Purchase full access to "{artworkTitle}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="bg-muted/50 rounded-2xl p-4">
              <PaymentMethodBadge showLegalCopy />
            </div>

            <div className="flex justify-between items-center px-2">
              <span className="text-muted-foreground font-bold uppercase tracking-widest text-xs">Total Amount ({gatewayCurrency})</span>
              <span className="font-black text-2xl text-primary">{gatewayDisplayAmount}</span>
            </div>

            <Alert className="rounded-2xl border-none bg-primary/5">
              <AlertCircle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm font-medium">
                Payments are processed securely. Once unlocked, this artwork will be available in your library and you'll have full access to high-resolution media.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button variant="ghost" className="rounded-xl font-bold" onClick={() => setConfirmOpen(false)} disabled={stripeProcessing || loading}>
              Discard
            </Button>
            <Button 
              className="flex-1 rounded-xl h-12 font-black transition-all active:scale-95 shadow-lg shadow-primary/20"
              onClick={handlePayment}
              disabled={loading || stripeProcessing}
            >
              {(loading || stripeProcessing) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Purchase
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </>
  );
}
