
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://sqdzemlcqesgjsybbhte.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZHplbWxjcWVzZ2pzeWJiaHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5OTY0ODQsImV4cCI6MjA2MzU3MjQ4NH0.dKaUnhMzIH6jb9glCo6ZnID4wavXA-R3W1dx53DD_lk";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function verify() {
  console.log("Searching for payment ID: pay_SS2JivwMF2yv5q across all payments...");
  const { data: payments, error: payError } = await supabase
    .from('payments')
    .select('*')
    .eq('razorpay_payment_id', 'pay_SS2JivwMF2yv5q');
    
  if (payError) console.error("Payment Error:", payError);
  else console.log("Payments found by payment ID:", JSON.stringify(payments, null, 2));

  console.log("\nSearching for any payments created today...");
  const today = new Date().toISOString().split('T')[0];
  const { data: recentPayments, error: recentError } = await supabase
    .from('payments')
    .select('*')
    .gte('created_at', today);
    
  if (recentError) console.error("Recent Payment Error:", recentError);
  else console.log("Recent Payments count:", recentPayments?.length || 0);

  console.log("\nSearching for all projects (first 100)...");
  const { data: projects, error: pError } = await supabase
    .from('projects')
    .select('id, title, status')
    .limit(100);
  
  if (pError) console.error("Project Error:", pError);
  else {
    console.log("Projects count:", projects?.length || 0);
    const target = projects?.find(p => p.id.startsWith('6ec23c4b'));
    if (target) console.log("FOUND TARGET PROJECT:", target);
    else console.log("Target project 6ec23c4b not found in first 100.");
  }
}

verify();
