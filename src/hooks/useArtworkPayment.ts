import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePaymentGateway } from "./usePaymentGateway";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface ArtworkPaymentOptions {
  artworkId: string;
  artistId?: string;
  onSuccess?: () => void;
  onFailure?: (error: string) => void;
}

export function useArtworkPayment() {
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const loadRazorpayScript = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      if (scriptLoaded && window.Razorpay) {
        resolve(true);
        return;
      }

      const existingScript = document.querySelector('script[src*="razorpay"]');
      if (existingScript && window.Razorpay) {
        setScriptLoaded(true);
        resolve(true);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => {
        setScriptLoaded(true);
        resolve(true);
      };
      script.onerror = () => {
        console.error("Failed to load Razorpay script");
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }, [scriptLoaded]);

  const { provider } = usePaymentGateway();

  const initiatePayment = useCallback(
    async ({ artworkId, artistId, onSuccess, onFailure }: ArtworkPaymentOptions) => {
      setLoading(true);

      try {
        // Get current session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("Please log in to unlock this artwork");
        }

        if (provider === "stripe") {
          const { data, error } = await supabase.functions.invoke(
            "create-checkout-session",
            {
              body: { artworkId },
            },
          );

          if (error || !data?.url) {
            throw new Error(
              error?.message ||
                data?.error ||
                "Failed to create checkout session",
            );
          }

          window.location.href = data.url;
          return;
        }

        // Load Razorpay script
        const loaded = await loadRazorpayScript();
        if (!loaded) {
          throw new Error("Failed to load payment gateway");
        }

        // Create order via edge function
        toast.info("Preparing payment gateway...", {
          description: "This won't take long.",
        });

        const { data, error } = await supabase.functions.invoke(
          "create-artwork-order",
          {
            body: { artworkId },
          },
        );

        if (error) {
          throw new Error(error.message || "Failed to create payment order");
        }

        if (!data?.orderId) {
          throw new Error(data?.error || "Failed to create payment order");
        }

        console.log("Artwork order created:", data);

        // Configure Razorpay options
        const options = {
          key: data.keyId,
          amount: data.amount,
          currency: data.currency,
          order_id: data.orderId,
          name: "Artswarit",
          description: `Unlock: ${data.artworkTitle}`,
          handler: async (response: any) => {
            console.log("Payment response:", response);

            try {
              // Verify payment
              const { data: verifyData, error: verifyError } =
                await supabase.functions.invoke("verify-artwork-payment", {
                  body: {
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    artworkId,
                  },
                });

              if (verifyError || !verifyData?.success) {
                throw new Error(
                  verifyData?.error || "Payment verification failed",
                );
              }

              toast.success("Artwork unlocked successfully!");
              onSuccess?.();
            } catch (err: any) {
              console.error("Verification error:", err);
              toast.error(err.message || "Payment verification failed");
              onFailure?.(err.message);
            }
          },
          prefill: {
            email: session.user.email,
          },
          theme: {
            color: "#f59e0b", // Yellow for premium
          },
          modal: {
            ondismiss: () => {
              setLoading(false);
              onFailure?.("Payment cancelled");
              console.log("Payment modal closed");
            },
          },
        };

        // Open Razorpay checkout
        const razorpay = new window.Razorpay(options);
        razorpay.on("payment.failed", (response: any) => {
          console.error("Payment failed:", response.error);
          toast.error(response.error.description || "Payment failed");
          onFailure?.(response.error.description);
          setLoading(false);
        });

        razorpay.open();
      } catch (error: any) {
        console.error("Payment error:", error);
        
        let errorMessage = error.message || "Payment failed";
        if (errorMessage.includes("credentials not configured") || errorMessage.includes("Razorpay Key ID missing")) {
          errorMessage = "Razorpay is not configured for this account yet. Please set up your payment keys in the settings.";
          toast.error("Config Required", {
            description: "Razorpay keys are missing. If you're an artist, set them in your dashboard.",
          });
        } else {
          toast.error(errorMessage);
        }
        
        onFailure?.(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [loadRazorpayScript, provider],
  );

  // Check if user has unlocked an artwork
  const checkUnlockStatus = useCallback(
    async (artworkId: string): Promise<boolean> => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return false;

        const { data } = await supabase
          .from("artwork_unlocks")
          .select("id")
          .eq("artwork_id", artworkId)
          .eq("user_id", session.user.id)
          .maybeSingle();

        return !!data;
      } catch (error) {
        console.error("Error checking unlock status:", error);
        return false;
      }
    },
    [],
  );

  return { initiatePayment, checkUnlockStatus, loading };
}





