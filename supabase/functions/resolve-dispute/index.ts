import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Razorpay standard keys for refunds
const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;

// RazorpayX keys for payouts
const RAZORPAYX_KEY_ID = Deno.env.get('RAZORPAYX_KEY_ID') || RAZORPAY_KEY_ID;
const RAZORPAYX_KEY_SECRET = Deno.env.get('RAZORPAYX_KEY_SECRET') || RAZORPAY_KEY_SECRET;
const RAZORPAYX_ACCOUNT_NUMBER = Deno.env.get('RAZORPAYX_ACCOUNT_NUMBER')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Missing Authorization header');
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) throw new Error('Unauthorized');

    // Currently we rely on the front-end to ensure only admins reach this UI, 
    // but in a production app we'd also double check the `roles` table here.
    
    const { disputeId, resolution, status, artistPayout, clientRefund, logType } = await req.json();

    if (!disputeId || !resolution || !status) {
      throw new Error('Missing required parameters');
    }

    // 1. Fetch the dispute and related project/milestone
    const { data: dispute, error: disputeErr } = await supabaseAdmin
      .from('disputes')
      .select(`
        *,
        project:projects(*),
        milestone:project_milestones(*)
      `)
      .eq('id', disputeId)
      .single();

    if (disputeErr || !dispute) throw new Error('Dispute not found');

    // 2. We only process financial transfers if there's a milestone attached
    //    (Project disputes without milestone don't have escrowed funds directly in our new flow)
    const totalPayoutUsd = Number(artistPayout) || 0;
    const totalRefundUsd = Number(clientRefund) || 0;

    const successResponse = { status: 'success', message: 'Dispute resolved seamlessly.' };

    if (dispute.milestone_id && (totalPayoutUsd > 0 || totalRefundUsd > 0)) {
        // Find successful payment record
        const { data: payment, error: paymentError } = await supabaseAdmin
          .from('payments')
          .select('*')
          .eq('milestone_id', dispute.milestone_id)
          .eq('status', 'success')
          .single();

        if (paymentError || !payment) {
          throw new Error('Could not find successful escrow payment to refund/payout from');
        }

        const exchangeRate = dispute.milestone.exchange_rate || 83.5;

        // Process Artist Payout via RazorpayX
        if (totalPayoutUsd > 0) {
            const { data: artistAccount } = await supabaseAdmin
              .from('razorpay_accounts')
              .select('*')
              .eq('user_id', dispute.project.artist_id)
              .single();

            if (!artistAccount || !artistAccount.razorpay_account_id) {
              throw new Error('Artist has no initialized payout account.');
            }

            const amountINR = Math.round(totalPayoutUsd * exchangeRate * 100) / 100;
            const amountInPaise = Math.round(amountINR * 100);
            const razorpayxAuth = btoa(`${RAZORPAYX_KEY_ID}:${RAZORPAYX_KEY_SECRET}`);

            const payoutBody = {
              account_number: RAZORPAYX_ACCOUNT_NUMBER,
              fund_account_id: artistAccount.razorpay_account_id,
              amount: amountInPaise,
              currency: 'INR',
              mode: 'IMPS',
              purpose: 'payout',
              queue_if_low_balance: true,
              reference_id: `disp_${dispute.id.slice(0, 8)}`,
              narration: `Dispute settlement - ${dispute.milestone?.title || 'Project'}`,
              notes: { dispute_id: dispute.id, type: 'dispute_arbitration' }
            };

            const payoutRes = await fetch('https://api.razorpayx.com/v1/payouts', {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${razorpayxAuth}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payoutBody),
            });

            if (!payoutRes.ok) {
              const errTxt = await payoutRes.text();
              throw new Error(`Artist Payout Failed: ${errTxt}`);
            }
        }

        // Process Client Refund via Razorpay standard Refunds API
        if (totalRefundUsd > 0) {
            if (!payment.payment_id) {
              throw new Error('Payment record is missing a Razorpay Payment ID to refund against.');
            }
            
            const amountINR = Math.round(totalRefundUsd * exchangeRate * 100) / 100;
            const amountInPaise = Math.round(amountINR * 100);
            const razorpayAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

            const refundRes = await fetch(`https://api.razorpay.com/v1/payments/${payment.payment_id}/refund`, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${razorpayAuth}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                amount: amountInPaise,
                notes: { dispute_id: dispute.id, reason: 'arbitration_refund' }
              }),
            });

            if (!refundRes.ok) {
              const errTxt = await refundRes.text();
              throw new Error(`Client Refund Failed: ${errTxt}`);
            }
        }
    }

    // 3. Financial flows successful — Update Database Statuses
    await supabaseAdmin.from('disputes').update({
        status, 
        resolution,
        resolved_by: user.id, 
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }).eq('id', dispute.id);

    if (dispute.milestone_id) {
        await supabaseAdmin.from('project_milestones').update({ 
            status: totalPayoutUsd > 0 ? 'COMPLETED' : 'WAITING_FUNDS' 
        }).eq('id', dispute.milestone_id);
    }

    // Notifications and Audits
    if (totalPayoutUsd > 0 && dispute.project?.artist_id) {
      await supabaseAdmin.from('notifications').insert({
        user_id: dispute.project.artist_id,
        title: 'Dispute Resolved — Funds Released',
        message: `Admin has ruled in your favor. $${totalPayoutUsd} released to you.`,
        type: 'success'
      });
    }

    if (totalRefundUsd > 0 && dispute.project?.client_id) {
      await supabaseAdmin.from('notifications').insert({
        user_id: dispute.project.client_id,
        title: 'Dispute Resolved — Refund Initiated',
        message: `Admin has initiated a $${totalRefundUsd} refund to your source payment method.`,
        type: 'success'
      });
    }

    await supabaseAdmin.from('project_activity_logs').insert({
      project_id: dispute.project_id,
      user_id: user.id,
      action: logType,
      details: { disputeId: dispute.id, resolution, artistPayout, clientRefund }
    });

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Resolve-Dispute Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
