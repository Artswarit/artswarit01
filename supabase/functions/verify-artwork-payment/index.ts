import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Web Crypto API for signature verification
async function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const data = `${orderId}|${paymentId}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computedSignature === signature;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error("Razorpay credentials not configured");
    }

    // Auth user
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Not authenticated");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Invalid authentication");
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      // NOTE: `artworkId` from the request body is an UNTRUSTED client hint only.
      // The authoritative artwork is derived from the Razorpay order below.
      artworkId: clientArtworkIdHint,
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new Error("Missing payment verification parameters");
    }

    // Verify signature
    const isValid = await verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      razorpayKeySecret
    );

    if (!isValid) {
      throw new Error("Invalid payment signature");
    }

    // The HMAC only proves that this order/payment pair was signed by Razorpay --
    // it says nothing about WHICH artwork the order was created for. Fetch the
    // order from Razorpay and use the server-written `notes` as the source of
    // truth, otherwise a caller could pay for a cheap artwork and unlock an
    // expensive one by passing a different artworkId.
    const razorpayAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const orderResponse = await fetch(
      `https://api.razorpay.com/v1/orders/${encodeURIComponent(razorpay_order_id)}`,
      { headers: { Authorization: `Basic ${razorpayAuth}` } }
    );

    if (!orderResponse.ok) {
      console.error("Failed to fetch Razorpay order:", razorpay_order_id, orderResponse.status);
      throw new Error("Could not verify payment order");
    }

    const order = await orderResponse.json();
    const notes = (order?.notes ?? {}) as Record<string, string>;

    if (order?.status !== "paid") {
      throw new Error("Payment order is not in a paid state");
    }

    if (notes.type !== "artwork_unlock") {
      throw new Error("Payment order is not an artwork purchase");
    }

    // The order must belong to the caller.
    if (notes.user_id !== user.id) {
      console.error("Order/user mismatch", { orderUser: notes.user_id, caller: user.id });
      throw new Error("This payment does not belong to the current user");
    }

    const artworkId = notes.artwork_id;
    if (!artworkId) {
      throw new Error("Payment order is missing artwork reference");
    }

    // A mismatch here means the client asked to unlock something other than what
    // it paid for. Reject rather than silently unlocking the correct one.
    if (clientArtworkIdHint && clientArtworkIdHint !== artworkId) {
      console.error("Artwork mismatch on verification", {
        requested: clientArtworkIdHint,
        paidFor: artworkId,
        userId: user.id,
      });
      throw new Error("Payment does not match the requested artwork");
    }

    // Idempotency: a retried verification (double callback, refreshed tab) must
    // succeed quietly instead of surfacing a unique-constraint error.
    const { data: existingUnlock } = await supabaseAdmin
      .from("artwork_unlocks")
      .select("id")
      .eq("artwork_id", artworkId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingUnlock) {
      return new Response(
        JSON.stringify({
          success: true,
          artworkId,
          message: "Artwork already unlocked",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Get artwork details
    const { data: artwork, error: artworkError } = await supabaseClient
      .from("artworks")
      .select("id, price, artist_id")
      .eq("id", artworkId)
      .single();

    if (artworkError || !artwork) {
      throw new Error("Artwork not found");
    }

    // Handle currency logic: if stored as INR, use directly. If USD, convert to INR.
    // const storedCurrency = (artwork.metadata as any)?.currency || 'USD';
    // const USD_TO_INR_RATE = 83.5;
    // let priceINR: number;
    // let priceUSD: number;

    // if (storedCurrency === 'INR') {
    //   priceINR = Number(artwork.price);
    //   priceUSD = priceINR / USD_TO_INR_RATE;
    // } else {
    //   priceUSD = Number(artwork.price);
    //   priceINR = priceUSD * USD_TO_INR_RATE;
    // }

    // Convert to paise (Razorpay uses smallest currency unit)
    // const amountInPaise = Math.round(priceINR * 100);
    
    // console.log(`Artwork order (${storedCurrency}): $${priceUSD.toFixed(2)} USD = ₹${priceINR.toFixed(2)} INR = ${amountInPaise} paise`);

    // Record the unlock in artwork_unlocks table
    const { error: unlockError } = await supabaseAdmin
      .from("artwork_unlocks")
      .insert({
        artwork_id: artworkId,
        user_id: user.id,
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
        amount: artwork.price,
      });

    if (unlockError) {
      console.error("Failed to record unlock:", unlockError);
      throw new Error("Failed to record artwork unlock");
    }

    // Create notification for artist
    await supabaseAdmin.from("notifications").insert({
      user_id: artwork.artist_id,
      type: "artwork_sold",
      title: "Artwork Sold!",
      message: `Your artwork was purchased for ₹${artwork.price}`,
      metadata: {
        artwork_id: artworkId,
        buyer_id: user.id,
        amount: artwork.price,
      },
    });

    // console.log("Artwork unlock verified:", { artworkId, userId: user.id, paymentId: razorpay_payment_id });

    return new Response(
      JSON.stringify({
        success: true,
        artworkId,
        message: "Payment verified and artwork unlocked!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Artwork verification error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
