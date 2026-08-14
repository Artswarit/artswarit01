import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
};

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Artwork purchases don't create a `payments` row -- create-artwork-order only
 * creates a Razorpay order, writing the artwork/user reference into its notes.
 * So when no payment record matches, the order may still be a legitimate
 * artwork purchase whose client-side verification never ran (tab closed,
 * network dropped). This resolves it from Razorpay and completes the unlock,
 * giving artwork purchases the same webhook safety net milestone funding has.
 *
 * Returns true when it handled the event as an artwork unlock.
 */
async function tryCompleteArtworkUnlock(
  supabaseAdmin: ReturnType<typeof createClient>,
  orderId: string,
  paymentId: string,
): Promise<boolean> {
  try {
    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!orderRes.ok) {
      console.error('Could not fetch Razorpay order for fallback unlock:', orderId, orderRes.status);
      return false;
    }

    const order = await orderRes.json();
    const notes = (order?.notes ?? {}) as Record<string, string>;

    if (notes.type !== 'artwork_unlock') return false;

    const artworkId = notes.artwork_id;
    const userId = notes.user_id;
    if (!artworkId || !userId) {
      console.error('Artwork order missing notes references:', orderId);
      return false;
    }

    // Idempotent: the client-side verify may have already completed this.
    const { data: existing } = await supabaseAdmin
      .from('artwork_unlocks')
      .select('id')
      .eq('artwork_id', artworkId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      console.log('Artwork already unlocked; webhook fallback no-op', { artworkId, userId });
      return true;
    }

    const { data: artwork } = await supabaseAdmin
      .from('artworks')
      .select('id, price, artist_id')
      .eq('id', artworkId)
      .maybeSingle();

    const { error: unlockError } = await supabaseAdmin.from('artwork_unlocks').insert({
      artwork_id: artworkId,
      user_id: userId,
      payment_id: paymentId,
      order_id: orderId,
      amount: artwork?.price ?? null,
    });

    if (unlockError) {
      console.error('Fallback unlock insert failed:', unlockError);
      return false;
    }

    if (artwork?.artist_id) {
      await supabaseAdmin.from('notifications').insert({
        user_id: artwork.artist_id,
        type: 'artwork_sold',
        title: 'Artwork Sold!',
        message: 'Your artwork was purchased.',
        metadata: { artwork_id: artworkId, buyer_id: userId },
      });
    }

    console.log('Completed artwork unlock via webhook fallback', { artworkId, userId });
    return true;
  } catch (err) {
    console.error('Artwork unlock fallback threw:', err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const signature = req.headers.get('x-razorpay-signature');
    const body = await req.text();

    // Signature is REQUIRED. Missing header = reject (prevents forged events).
    if (!signature) {
      console.error('Webhook rejected: missing x-razorpay-signature header');
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify webhook signature
    const encoder = new TextEncoder();
    const key = encoder.encode(RAZORPAY_KEY_SECRET);
    const data = encoder.encode(body);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const expectedSignature = await crypto.subtle.sign("HMAC", cryptoKey, data);
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (expectedHex !== signature) {
      console.error('Webhook signature verification failed');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.parse(body);
    const eventId = payload.event + '_' + (payload.payload?.payment?.entity?.id || Date.now());
    const eventType = payload.event;

    // Check for idempotency
    const { data: existingLog } = await supabaseAdmin
      .from('webhook_logs')
      .select('id')
      .eq('event_id', eventId)
      .single();

    if (existingLog) {
      console.log('Event already processed:', eventId);
      return new Response(JSON.stringify({ success: true, message: 'Already processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log the webhook event
    await supabaseAdmin.from('webhook_logs').insert({
      event_id: eventId,
      event_type: eventType,
      payload: payload,
      processed: false,
    });

    // Handle payment.captured event
    if (eventType === 'payment.captured') {
      const payment = payload.payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;

      // Find the payment record
      const { data: paymentRecord, error: fetchError } = await supabaseAdmin
        .from('payments')
        .select('*, milestone:project_milestones(*)')
        .eq('razorpay_order_id', orderId)
        .single();

      if (fetchError || !paymentRecord) {
        // No payments row: this may be an artwork purchase (those only exist as
        // a Razorpay order). Previously every artwork payment fell through here
        // and was discarded, so a buyer whose tab closed after paying lost the
        // unlock permanently with no recovery path.
        const handledAsArtwork = await tryCompleteArtworkUnlock(supabaseAdmin, orderId, paymentId);

        console[handledAsArtwork ? 'log' : 'error'](
          handledAsArtwork
            ? `Handled artwork unlock via fallback for order: ${orderId}`
            : `Payment record not found for order: ${orderId}`
        );

        await supabaseAdmin.from('webhook_logs').update({
          processed: true,
          error_message: handledAsArtwork ? null : 'Payment record not found',
          processed_at: new Date().toISOString(),
        }).eq('event_id', eventId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Skip if already processed
      if (paymentRecord.status === 'success') {
        await supabaseAdmin.from('webhook_logs').update({
          processed: true,
          processed_at: new Date().toISOString(),
        }).eq('event_id', eventId);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update payment status
      await supabaseAdmin.from('payments').update({
        razorpay_payment_id: paymentId,
        status: 'success',
        paid_at: new Date().toISOString(),
      }).eq('id', paymentRecord.id);

      // Update milestone status to ACTIVE (funds secured in escrow)
      await supabaseAdmin.from('project_milestones').update({
        status: 'ACTIVE',
        paid_at: new Date().toISOString(),
        payment_id: paymentId,
      }).eq('id', paymentRecord.milestone_id);

      // Log activity
      await supabaseAdmin.from('project_activity_logs').insert({
        project_id: paymentRecord.project_id,
        milestone_id: paymentRecord.milestone_id,
        user_id: paymentRecord.client_id,
        action: 'payment_completed_webhook',
        details: {
          amount: paymentRecord.amount,
          razorpay_payment_id: paymentId,
        },
      });

      // Notify artist
      await supabaseAdmin.from('notifications').insert({
        user_id: paymentRecord.artist_id,
        type: 'payment',
        title: 'Payment Received!',
        message: `You received $${paymentRecord.artist_payout} for milestone "${paymentRecord.milestone?.title}"`,
        metadata: {
          milestone_id: paymentRecord.milestone_id,
          project_id: paymentRecord.project_id,
          amount: paymentRecord.artist_payout,
        },
      });

      // console.log('Payment processed successfully via webhook');
    }

    // Handle payment.failed event
    if (eventType === 'payment.failed') {
      const payment = payload.payload.payment.entity;
      const orderId = payment.order_id;

      await supabaseAdmin.from('payments').update({
        status: 'failed',
        error_message: payment.error_description || 'Payment failed',
      }).eq('razorpay_order_id', orderId);
    }

    // Mark webhook as processed
    await supabaseAdmin.from('webhook_logs').update({
      processed: true,
      processed_at: new Date().toISOString(),
    }).eq('event_id', eventId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
