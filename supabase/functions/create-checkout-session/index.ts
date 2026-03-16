import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from "https://esm.sh/stripe@14.21.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')!
    supabase.auth.setSession({
      access_token: authHeader.replace('Bearer ', ''),
      refresh_token: '',
    })

    // Get user from auth token
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('Authentication error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { artworkId, milestoneId } = await req.json()

    if (!artworkId && !milestoneId) {
      return new Response(
        JSON.stringify({ error: 'Artwork ID or Milestone ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    let itemTitle = '';
    let itemDescription = '';
    let itemPrice = 0;
    let sellerId = '';
    let metadata: Record<string, string | number | null> = { buyer_id: user.id };

    if (artworkId) {
      // Fetch artwork details
      const { data: artwork, error: artworkError } = await supabase
        .from('artworks')
        .select('*')
        .eq('id', artworkId)
        .single()

      if (artworkError || !artwork) {
        console.error('Artwork fetch error:', artworkError)
        return new Response(JSON.stringify({ error: 'Artwork not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (!artwork.price || artwork.price <= 0) {
        return new Response(JSON.stringify({ error: 'Artwork is not for sale' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      itemTitle = artwork.title;
      itemDescription = `Artwork purchase by ${user.email}`;
      itemPrice = artwork.price;
      sellerId = artwork.artist_id;
      metadata = { ...metadata, artwork_id: artworkId, seller_id: sellerId, type: 'artwork_purchase' };
    } else if (milestoneId) {
      // Fetch milestone details
      const { data: milestone, error: milestoneError } = await supabase
        .from('project_milestones')
        .select('*, projects(*)')
        .eq('id', milestoneId)
        .single();

      if (milestoneError || !milestone) {
        console.error('Milestone fetch error:', milestoneError);
        return new Response(JSON.stringify({ error: 'Milestone not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      itemTitle = `Milestone: ${milestone.title}`;
      itemDescription = `Project: ${milestone.projects.title}`;
      itemPrice = milestone.amount; // Wahrheit is USD
      sellerId = milestone.projects.artist_id;
      metadata = { ...metadata, milestone_id: milestoneId, project_id: milestone.project_id, seller_id: sellerId, type: 'milestone_payment' };
    }

    // Fetch latest exchange rate (INR)
    const { data: ratesData } = await supabase
      .from('exchange_rates')
      .select('rates')
      .eq('base_currency', 'USD')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const exchangeRates = (ratesData?.rates as Record<string, number>) || { INR: 83.5 };
    const currentRate = exchangeRates.INR || 83.5;

    // Check if user is in India to decide currency (optional, Stripe can handle USD for everyone)
    // But for consistency with Razorpay, we'll use USD as base for Stripe.
    const currency = 'usd';

    // Set up Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    // Create Stripe checkout session
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: itemTitle,
              description: itemDescription,
            },
            unit_amount: Math.round(itemPrice * 100), // Stripe expects cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: artworkId 
        ? `${req.headers.get('origin')}/artwork/${artworkId}?status=success`
        : `${req.headers.get('origin')}/artist-dashboard?milestone=success`,
      cancel_url: artworkId
        ? `${req.headers.get('origin')}/artwork/${artworkId}?status=cancel`
        : `${req.headers.get('origin')}/artist-dashboard?milestone=cancel`,
      metadata: metadata,
    });

    // Insert pending transaction with locked rate
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        artwork_id: artworkId || null,
        milestone_id: milestoneId || null,
        buyer_id: user.id,
        seller_id: sellerId,
        amount: itemPrice,
        amount_usd: itemPrice,
        currency: 'USD',
        exchange_rate: currentRate,
        stripe_payment_intent_id: stripeSession.id,
        status: 'pending'
      });

    if (transactionError) {
      console.error('Transaction creation error:', transactionError);
      // We don't return error here because the Stripe session is already created 
      // and the user will be redirected. But we should log it.
    }

    return new Response(
      JSON.stringify({ url: stripeSession.url, sessionId: stripeSession.id }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    // console.error('Unexpected error:', error)
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errMsg }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})