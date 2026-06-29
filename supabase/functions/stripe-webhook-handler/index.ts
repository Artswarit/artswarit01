import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { phCapture } from '../_shared/posthog.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    
    if (!stripeSecretKey || !webhookSecret) {
      console.error('Missing Stripe configuration')
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      console.error('Missing stripe-signature header')
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Webhook signature verification failed:', errMessage)
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // console.log('Verified webhook event:', event.type)

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata;
      const _userId = metadata?.user_id || metadata?.buyer_id;
      const type = metadata?.type || (metadata?.plan ? 'premium_plan' : 'unknown');

      console.log(`Processing ${event.type} for type: ${type}`);

      if (type === 'artwork_purchase') {
        const artworkId = metadata?.artwork_id;
        const buyerId = metadata?.buyer_id;
        const sellerId = metadata?.seller_id;

        // 1. Update transaction
        await supabase
          .from('transactions')
          .update({ status: 'success' })
          .eq('stripe_payment_intent_id', session.id);

        // 2. Clear price and archive artwork
        await supabase
          .from('artworks')
          .update({ price: null, status: 'archived' })
          .eq('id', artworkId);

        // 3. Insert into artwork_unlocks
        await supabase
          .from('artwork_unlocks')
          .insert({ artwork_id: artworkId, user_id: buyerId });

        // 4. Notifications
        await supabase.from('notifications').insert([
          { user_id: sellerId, type: 'sale', title: 'Artwork Sold!', message: `Your artwork has been sold.` },
          { user_id: buyerId, type: 'purchase', title: 'Purchase Confirmed', message: `You have unlocked new artwork.` }
        ]);
      } else if (type === 'milestone_payment') {
        const milestoneId = metadata?.milestone_id;
        const projectId = metadata?.project_id;
        const clientId = metadata?.buyer_id;
        const artistId = metadata?.seller_id;

        // 1. Update transaction
        await supabase
          .from('transactions')
          .update({ status: 'success' })
          .eq('stripe_payment_intent_id', session.id);

        // 2. Update milestone status to PAID (escrow)
        await supabase
          .from('project_milestones')
          .update({ status: 'PAID' })
          .eq('id', milestoneId);

        // 3. Update payment record
        await supabase
          .from('payments')
          .update({ status: 'success', stripe_session_id: session.id })
          .eq('milestone_id', milestoneId);

        // 4. Notifications
        await supabase.from('notifications').insert([
          { user_id: artistId, type: 'milestone_paid', title: 'Milestone Funded', message: `A milestone for your project has been funded.` },
          { user_id: clientId, type: 'payment_success', title: 'Payment Successful', message: `Milestone payment was successful.` }
        ]);

        // Analytics — server-confirmed escrow funding.
        const amount = (session.amount_total ?? 0) / 100;
        const ctx = {
          provider: 'stripe',
          project_id: projectId,
          milestone_id: milestoneId,
          artist_id: artistId,
          client_id: clientId,
          payment_id: session.payment_intent ?? session.id,
          amount,
          currency: (session.currency ?? 'usd').toUpperCase(),
        };
        if (clientId) {
          await phCapture('payment_success', clientId, { ...ctx, kind: 'milestone' });
          await phCapture('escrow_created', clientId, ctx);
        }
      } else if (type === 'premium_plan') {
        const userId = metadata?.user_id;
        const plan = metadata?.plan;

        // Update user's subscriber status
        const { error: subError } = await supabase
          .from('subscribers')
          .insert({
            user_id: userId,
            plan: plan,
            is_active: true,
            started_at: new Date().toISOString(),
          });

        if (subError) console.error('Subscription insert error:', subError);

        // Notification
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'system',
          title: 'Premium Activated',
          message: `Welcome to ${plan}! You now have 0% platform fees.`
        });

        // Analytics — server-confirmed subscription upgrade.
        if (userId) {
          const subCtx = {
            provider: 'stripe',
            plan,
            subscription_id: session.subscription ?? session.id,
            invoice_id: session.invoice ?? null,
            amount: (session.amount_total ?? 0) / 100,
            currency: (session.currency ?? 'usd').toUpperCase(),
            billing_cycle: plan,
            renewal_number: 1,
          };
          await phCapture('subscription_upgraded', userId, subCtx);
          await phCapture('payment_success', userId, { ...subCtx, kind: 'subscription' });
        }
      }
    }

    // Stripe subscription lifecycle — fire only after webhook signature has
    // already been verified above. We resolve user_id via the subscribers row
    // we keyed on the Stripe subscription id at upgrade time.
    const lifecycle: Record<string, string | null> = {
      'invoice.paid': 'subscription_renewed',
      'invoice.payment_failed': 'subscription_payment_failed',
      'invoice.payment_succeeded': 'subscription_payment_recovered',
      'customer.subscription.deleted': 'subscription_cancelled',
      'customer.subscription.updated': null, // handled below for cancel_at_period_end
    };
    if (event.type in lifecycle || event.type === 'customer.subscription.updated') {
      const obj: any = event.data.object;
      const subscriptionId: string | undefined = obj.subscription ?? obj.id;
      let analyticsEvent = lifecycle[event.type];

      // Mark expired vs cancelled vs renewed based on payload shape.
      if (event.type === 'customer.subscription.updated') {
        if (obj.status === 'canceled' || obj.cancel_at_period_end) analyticsEvent = 'subscription_cancelled';
        else if (obj.status === 'unpaid' || obj.status === 'past_due') analyticsEvent = 'subscription_payment_failed';
      }
      if (event.type === 'customer.subscription.deleted' && obj.ended_at && !obj.canceled_at) {
        analyticsEvent = 'subscription_expired';
      }

      if (analyticsEvent && subscriptionId) {
        const { data: sub } = await supabase
          .from('subscribers')
          .select('user_id, plan, subscription_tier, email')
          .eq('stripe_customer_id', subscriptionId)
          .maybeSingle();

        if (sub?.user_id) {
          await phCapture(analyticsEvent as string, sub.user_id, {
            provider: 'stripe',
            plan: sub.plan ?? sub.subscription_tier ?? null,
            subscription_id: subscriptionId,
            invoice_id: obj.id ?? null,
            amount: obj.amount_paid ? obj.amount_paid / 100 : (obj.amount_due ?? 0) / 100,
            currency: (obj.currency ?? 'usd').toUpperCase(),
            failure_reason: obj.last_payment_error?.message ?? obj.billing_reason ?? null,
          });
        }
      }
    }


    return new Response(
      JSON.stringify({ received: true }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})