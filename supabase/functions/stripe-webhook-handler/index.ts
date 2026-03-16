import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

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
        const _projectId = metadata?.project_id;
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