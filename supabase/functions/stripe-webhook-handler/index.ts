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

        if (!artworkId || !buyerId) {
          console.error('artwork_purchase webhook missing metadata', { artworkId, buyerId, session: session.id });
          throw new Error('Missing artwork or buyer reference on checkout session');
        }

        // Idempotency: Stripe delivers at-least-once, so a retry must not
        // re-notify or re-archive. The unlock row is the marker of completion.
        const { data: alreadyUnlocked } = await supabase
          .from('artwork_unlocks')
          .select('id')
          .eq('artwork_id', artworkId)
          .eq('user_id', buyerId)
          .maybeSingle();

        if (alreadyUnlocked) {
          console.log('Artwork already unlocked, skipping duplicate webhook', { artworkId, buyerId });
        } else {
          // Every write below was previously unchecked, so a failure anywhere
          // left the buyer charged with no unlock and no signal.

          // 1. Update transaction
          const { error: txError } = await supabase
            .from('transactions')
            .update({ status: 'success' })
            .eq('stripe_payment_intent_id', session.id);
          if (txError) console.error('Failed to mark transaction success:', txError);

          // 2. Insert the unlock FIRST -- it is what the buyer actually paid
          //    for. Archiving the artwork before this meant a failure here left
          //    the artwork unavailable AND unowned.
          const { error: unlockError } = await supabase
            .from('artwork_unlocks')
            .insert({ artwork_id: artworkId, user_id: buyerId });
          if (unlockError) {
            console.error('Failed to record artwork unlock:', unlockError);
            throw new Error('Could not record artwork unlock');
          }

          // 3. Clear price and archive artwork
          const { error: archiveError } = await supabase
            .from('artworks')
            .update({ price: null, status: 'archived' })
            .eq('id', artworkId);
          if (archiveError) console.error('Failed to archive artwork:', archiveError);

          // 4. Notifications
          const { error: notifyError } = await supabase.from('notifications').insert([
            { user_id: sellerId, type: 'sale', title: 'Artwork Sold!', message: `Your artwork has been sold.` },
            { user_id: buyerId, type: 'purchase', title: 'Purchase Confirmed', message: `You have unlocked new artwork.` }
          ]);
          if (notifyError) console.error('Failed to send purchase notifications:', notifyError);
        }
      } else if (type === 'milestone_payment') {
        const milestoneId = metadata?.milestone_id;
        const projectId = metadata?.project_id;
        const clientId = metadata?.buyer_id;
        const artistId = metadata?.seller_id;

        // 1. Update transaction
        const { error: txError } = await supabase
          .from('transactions')
          .update({ status: 'success' })
          .eq('stripe_payment_intent_id', session.id);
        if (txError) console.error('Failed to mark milestone transaction success:', txError);

        // 2. Move the milestone into escrow.
        //    This previously wrote 'PAID', which is not a member of the
        //    milestone_status_v2 enum ('LOCKED' | 'WAITING_FUNDS' | 'ACTIVE' |
        //    'REVIEW_PENDING' | 'REVISION_REQUESTED' | 'COMPLETED' |
        //    'DISPUTED'), so the write always failed -- silently, because the
        //    result was never checked. Stripe-funded milestones therefore never
        //    activated after payment. 'ACTIVE' is the funded state, matching
        //    what the Razorpay path sets.
        //    Scoped to WAITING_FUNDS so a retry cannot regress a milestone that
        //    has already progressed.
        const { error: milestoneError } = await supabase
          .from('project_milestones')
          .update({ status: 'ACTIVE', paid_at: new Date().toISOString() })
          .eq('id', milestoneId)
          .eq('status', 'WAITING_FUNDS');
        if (milestoneError) {
          console.error('Failed to activate milestone after payment:', milestoneError);
          throw new Error('Could not activate milestone after payment');
        }

        // 3. Update payment record
        const { error: paymentError } = await supabase
          .from('payments')
          .update({ status: 'success', stripe_session_id: session.id })
          .eq('milestone_id', milestoneId);
        if (paymentError) console.error('Failed to mark payment success:', paymentError);

        // 4. Notifications
        const { error: notifyError } = await supabase.from('notifications').insert([
          { user_id: artistId, type: 'milestone_paid', title: 'Milestone Funded', message: `A milestone for your project has been funded.` },
          { user_id: clientId, type: 'payment_success', title: 'Payment Successful', message: `Milestone payment was successful.` }
        ]);
        if (notifyError) console.error('Failed to send milestone funding notifications:', notifyError);

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

        // `subscribers` has no `plan` column -- the tier lives in the
        // `subscription_tier` enum ('monthly' | 'yearly' | 'lifetime'). The
        // checkout plan keys are 'pro' | 'monthly' | 'yearly', and 'pro' bills
        // monthly. Writing `plan` previously made this insert fail outright, so
        // Stripe subscribers were charged but never actually marked premium.
        const subscriptionTier = plan === 'yearly' ? 'yearly' : 'monthly';

        // useArtistPlan treats renew_at IS NULL as a never-expiring plan, so an
        // explicit period end is required for recurring tiers.
        const periodDays = subscriptionTier === 'yearly' ? 365 : 30;
        const renewAt = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString();

        const subscriberEmail =
          session.customer_details?.email ?? session.customer_email ?? '';

        // Upsert (not insert) so Stripe's at-least-once webhook delivery cannot
        // create duplicate subscriber rows on retry. Mirrors the Razorpay path.
        // NOTE: stripe_customer_id stores the *subscription* id here, matching
        // the existing convention the lifecycle handler below looks up by.
        const { error: subError } = await supabase
          .from('subscribers')
          .upsert({
            user_id: userId,
            email: subscriberEmail,
            subscription_tier: subscriptionTier,
            is_active: true,
            started_at: new Date().toISOString(),
            renew_at: renewAt,
            stripe_customer_id: session.subscription ?? session.id,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,subscription_tier',
            ignoreDuplicates: false,
          });

        if (subError) console.error('Subscription upsert error:', subError);

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
        // `plan` is not a column on subscribers -- selecting it made this query
        // fail, so no lifecycle event ever resolved a user.
        const { data: sub } = await supabase
          .from('subscribers')
          .select('id, user_id, subscription_tier, email')
          .eq('stripe_customer_id', subscriptionId)
          .maybeSingle();

        if (sub?.user_id) {
          // Revoke access when the subscription actually ends. Without this a
          // cancelled Stripe subscriber kept 0% platform fees indefinitely
          // (the Razorpay path already did this).
          if (analyticsEvent === 'subscription_cancelled' || analyticsEvent === 'subscription_expired') {
            const { error: revokeError } = await supabase
              .from('subscribers')
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq('id', sub.id);
            if (revokeError) console.error('Failed to revoke subscription:', revokeError);
          }

          // Extend the access window on a successful renewal, otherwise an
          // actively-paying subscriber lapses when the initial renew_at passes.
          if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
            const periodDays = sub.subscription_tier === 'yearly' ? 365 : 30;
            const nextRenewAt = obj.lines?.data?.[0]?.period?.end
              ? new Date(obj.lines.data[0].period.end * 1000).toISOString()
              : new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString();

            const { error: renewError } = await supabase
              .from('subscribers')
              .update({ is_active: true, renew_at: nextRenewAt, updated_at: new Date().toISOString() })
              .eq('id', sub.id);
            if (renewError) console.error('Failed to extend subscription:', renewError);
          }

          await phCapture(analyticsEvent as string, sub.user_id, {
            provider: 'stripe',
            plan: sub.subscription_tier ?? null,
            subscription_id: subscriptionId,
            invoice_id: obj.id ?? null,
            amount: obj.amount_paid ? obj.amount_paid / 100 : (obj.amount_due ?? 0) / 100,
            currency: (obj.currency ?? 'usd').toUpperCase(),
            failure_reason: obj.last_payment_error?.message ?? obj.billing_reason ?? null,
          });
        }
      }
    }

    // Stripe dispute (chargeback) lifecycle. When a buyer disputes a charge,
    // mark the related transaction as disputed, notify the seller, log an
    // admin audit event, and emit analytics so finance can react.
    if (
      event.type === 'charge.dispute.created' ||
      event.type === 'charge.dispute.closed' ||
      event.type === 'charge.dispute.funds_withdrawn' ||
      event.type === 'charge.dispute.funds_reinstated'
    ) {
      const dispute: any = event.data.object;
      const paymentIntentId: string | undefined = dispute.payment_intent;
      const chargeId: string | undefined = dispute.charge;
      const amount = (dispute.amount ?? 0) / 100;
      const currency = (dispute.currency ?? 'usd').toUpperCase();

      // Map dispute status to a transaction status we care about.
      let txStatus: string | null = null;
      if (event.type === 'charge.dispute.created' || event.type === 'charge.dispute.funds_withdrawn') {
        txStatus = 'disputed';
      } else if (event.type === 'charge.dispute.closed') {
        txStatus = dispute.status === 'won' ? 'success' : dispute.status === 'lost' ? 'refunded' : 'disputed';
      } else if (event.type === 'charge.dispute.funds_reinstated') {
        txStatus = 'success';
      }

      // Find the transaction by payment intent id (matches what checkout stores).
      let tx: any = null;
      if (paymentIntentId) {
        const { data } = await supabase
          .from('transactions')
          .select('id, buyer_id, seller_id, artwork_id')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .maybeSingle();
        tx = data;
      }

      if (tx && txStatus) {
        await supabase.from('transactions').update({ status: txStatus }).eq('id', tx.id);
      }

      // Notify the seller so they know a chargeback is in progress / resolved.
      if (tx?.seller_id) {
        const title =
          event.type === 'charge.dispute.created' ? 'Payment Disputed'
          : event.type === 'charge.dispute.closed' ? `Dispute ${dispute.status ?? 'closed'}`
          : event.type === 'charge.dispute.funds_withdrawn' ? 'Disputed Funds Held'
          : 'Disputed Funds Restored';
        await supabase.from('notifications').insert({
          user_id: tx.seller_id,
          type: 'dispute',
          title,
          message: `${currency} ${amount.toFixed(2)} — ${dispute.reason ?? 'chargeback'}.`,
          metadata: { dispute_id: dispute.id, charge_id: chargeId, payment_intent_id: paymentIntentId },
        });
      }

      // Admin audit log so finance/admin dashboards surface the event.
      try {
        await supabase.from('admin_audit_logs').insert({
          action: event.type,
          target_type: 'stripe_dispute',
          target_id: dispute.id,
          metadata: {
            reason: dispute.reason,
            status: dispute.status,
            amount,
            currency,
            charge_id: chargeId,
            payment_intent_id: paymentIntentId,
            transaction_id: tx?.id ?? null,
            buyer_id: tx?.buyer_id ?? null,
            seller_id: tx?.seller_id ?? null,
          },
        });
      } catch (err) {
        console.error('admin_audit_logs insert failed:', err);
      }

      // Analytics — surface the chargeback lifecycle for funnels/alerts.
      const analyticsUser = tx?.buyer_id ?? tx?.seller_id;
      if (analyticsUser) {
        await phCapture('payment_disputed', analyticsUser, {
          provider: 'stripe',
          event: event.type,
          dispute_id: dispute.id,
          reason: dispute.reason,
          status: dispute.status,
          amount,
          currency,
          charge_id: chargeId,
          payment_intent_id: paymentIntentId,
        });
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