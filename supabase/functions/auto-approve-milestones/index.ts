import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const RAZORPAYX_KEY_ID = Deno.env.get('RAZORPAYX_KEY_ID') || Deno.env.get('RAZORPAY_KEY_ID');
const RAZORPAYX_KEY_SECRET = Deno.env.get('RAZORPAYX_KEY_SECRET') || Deno.env.get('RAZORPAY_KEY_SECRET');
const RAZORPAYX_ACCOUNT_NUMBER = Deno.env.get('RAZORPAYX_ACCOUNT_NUMBER');

const STARTER_COMMISSION = 0.15;
const PRO_COMMISSION = 0;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    // Ensure caller is using the service role key since this should only be called by cron
    if (!authHeader?.includes(SUPABASE_SERVICE_ROLE_KEY) && authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized. This function must be triggered by a cron job with service role credentials.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find milestones that are overdue for review
    const { data: milestones, error: milestoneError } = await supabaseAdmin
      .from('project_milestones')
      .select(`
        *,
        project:projects(*)
      `)
      .eq('status', 'REVIEW_PENDING')
      .lte('auto_approve_at', new Date().toISOString());

    if (milestoneError) {
      console.error('Error finding overdue milestones:', milestoneError);
      return new Response(JSON.stringify({ error: 'Failed to query database' }), { status: 500 });
    }

    if (!milestones || milestones.length === 0) {
      console.log('No milestones to auto-approve.');
      return new Response(JSON.stringify({ message: 'No milestones to auto-approve' }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${milestones.length} milestones to auto-approve.`);
    
    const results = [];

    for (const milestone of milestones) {
      console.log(`Processing milestone ${milestone.id}...`);
      try {
        // 1. Find successful payment record
        const { data: payment, error: paymentError } = await supabaseAdmin
          .from('payments')
          .select('*')
          .eq('milestone_id', milestone.id)
          .eq('status', 'success')
          .single();

        if (paymentError || !payment) {
          throw new Error('No successful payment found for this milestone');
        }

        // 2. Fetch artist payout account
        const { data: artistAccount, error: accountError } = await supabaseAdmin
          .from('razorpay_accounts')
          .select('*')
          .eq('user_id', milestone.project.artist_id)
          .single();

        if (accountError || !artistAccount || !artistAccount.payouts_enabled || !artistAccount.razorpay_account_id) {
          throw new Error('Artist payout account not found or disabled');
        }

        // 3. Setup payout amounts
        const grossAmount = Number(payment.amount);
        let platformFee: number;
        let payoutAmount: number;

        if (payment.platform_fee != null && payment.artist_payout != null) {
          platformFee = Number(payment.platform_fee);
          payoutAmount = Number(payment.artist_payout);
        } else {
          const { data: subscription } = await supabaseAdmin
            .from('subscribers')
            .select('*')
            .eq('user_id', milestone.project.artist_id)
            .eq('is_active', true)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          const feeRate = subscription ? PRO_COMMISSION : STARTER_COMMISSION;
          platformFee = Number((grossAmount * feeRate).toFixed(2));
          payoutAmount = Number((grossAmount - platformFee).toFixed(2));
        }

        // 4. Fire RazorpayX Request
        const exchangeRate = milestone.exchange_rate || 83.5;
        const amountINR = Math.round(payoutAmount * exchangeRate * 100) / 100;
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
          reference_id: `auto_${milestone.id.slice(0, 8)}`,
          narration: `Auto-approval payout - ${milestone.title}`,
          notes: {
            milestone_id: milestone.id,
            project_id: milestone.project_id,
            type: 'auto_approval',
          },
        };

        const payoutResponse = await fetch('https://api.razorpayx.com/v1/payouts', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${razorpayxAuth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payoutBody),
        });

        if (!payoutResponse.ok) {
          const errorText = await payoutResponse.text();
          throw new Error(`RazorpayX failed: ${errorText}`);
        }

        const payout = await payoutResponse.json();

        // 5. Update Milestone Status
        await supabaseAdmin
          .from('project_milestones')
          .update({
            status: 'COMPLETED',
            payout_id: payout.id,
          })
          .eq('id', milestone.id);

        // 6. Log activity
        await supabaseAdmin.from('project_activity_logs').insert({
          project_id: milestone.project_id,
          milestone_id: milestone.id,
          user_id: 'system', // the system did the approval
          action: 'milestone_auto_approved',
          details: { milestoneId: milestone.id },
        });

        // 7. Unlock next milestone if sequential, else mark project complete
        const { data: siblings } = await supabaseAdmin
          .from('project_milestones')
          .select('id, sort_order, status') // Fixed sequence_order to sort_order
          .eq('project_id', milestone.project_id)
          .order('sort_order');

        if (siblings) {
          const thisIndex = siblings.findIndex((m: { id: string }) => m.id === milestone.id);
          if (thisIndex !== -1 && thisIndex < siblings.length - 1) {
            const nextMilestone = siblings[thisIndex + 1];
            if (nextMilestone.status === 'LOCKED') {
              await supabaseAdmin
                .from('project_milestones')
                .update({ status: 'WAITING_FUNDS' })
                .eq('id', nextMilestone.id);

              await supabaseAdmin.from('project_activity_logs').insert({
                project_id: milestone.project_id,
                milestone_id: nextMilestone.id,
                user_id: 'system',
                action: 'milestone_unlocked',
                details: { unlocked_by_auto_approval: milestone.id },
              });
            }
          } else if (thisIndex === siblings.length - 1) {
             // Last milestone auto-approved. Mark project completed.
             const { error: completeProjectError } = await supabaseAdmin
               .from('projects')
               .update({ status: 'completed', progress: 100 })
               .eq('id', milestone.project_id);
               
             if (completeProjectError) {
                console.error('Failed to mark project complete automatically:', completeProjectError);
             }
          }
        }

        results.push({ milestone: milestone.id, status: 'success' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error processing milestone ${milestone.id}:`, err);
        results.push({ milestone: milestone.id, status: 'error', error: message });
      }
    }

    return new Response(JSON.stringify({
      message: 'Auto-approval job finished',
      processed: results.length,
      results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Edge function fatal error:', error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
