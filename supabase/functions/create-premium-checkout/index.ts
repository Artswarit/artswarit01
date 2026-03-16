import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

// CORS settings
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse body
    const { plan } = await req.json();
    if (!plan) throw new Error("Missing required 'plan' parameter");

    // Auth user (using Supabase anon key for context)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data?.user;
    if (!user?.email) throw new Error("Supabase user not found or missing email");

    // Set up Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Find or create customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

    // Fetch user profile to check country
    const { data: profile } = await supabaseClient
      .from('public_profiles')
      .select('country')
      .eq('id', user.id)
      .single();
    
    const isIndian = profile?.country === 'IN' || profile?.country === 'India';
    const currency = isIndian ? "inr" : "usd";

    // NEW PLAN CONFIG: Regional pricing
    const planConfigs: Record<string, { price: number; name: string; interval?: "month" | "year"; id: string }> = {
      pro: {
        price: isIndian ? 49900 : 599, // ₹499 or $5.99
        name: "Pro Artist",
        interval: "month",
        id: "artswarit-pro-artist"
      },
      monthly: {
        price: isIndian ? 49900 : 599,
        name: "Pro Artist Monthly",
        interval: "month",
        id: "artswarit-pro-monthly"
      },
      yearly: {
        price: isIndian ? 499900 : 5999, // ₹4999 or $59.99
        name: "Pro Artist Yearly",
        interval: "year",
        id: "artswarit-pro-yearly"
      }
    };

    const config = planConfigs[plan];
    if (!config) throw new Error("Invalid plan. Valid options: pro, monthly, yearly");

    const lineItem = {
      price_data: {
        currency: currency,
        product_data: {
          name: config.name,
          description: "0% platform fees • Unlimited portfolio • Priority ranking • Featured rotation"
        },
        unit_amount: config.price,
        recurring: config.interval ? { interval: config.interval } : undefined
      },
      quantity: 1
    };

    // Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: !customerId ? user.email : undefined,
      line_items: [lineItem],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/artist-dashboard?premium=success&plan=${plan}`,
      cancel_url: `${req.headers.get("origin")}/artist-dashboard?premium=cancel`,
      metadata: {
        user_id: user.id,
        plan,
      }
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
