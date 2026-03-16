const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://sqdzemlcqesgjsybbhte.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZHplbWxjcWVzZ2pzeWJiaHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5OTY0ODQsImV4cCI6MjA2MzU3MjQ4NH0.dKaUnhMzIH6jb9glCo6ZnID4wavXA-R3W1dx53DD_lk";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function checkSpecificColumns() {
  const { data, error } = await supabase.from('projects').select('id, title, budget, amount_usd').limit(1);
  if (error) {
    console.log('Error selecting amount_usd:', error.message);
  } else {
    console.log('amount_usd column exists!');
  }

  const { data: milestones, error: milestoneError } = await supabase.from('project_milestones').select('id, amount_usd').limit(1);
  if (milestoneError) {
    console.log('Error selecting amount_usd from project_milestones:', milestoneError.message);
  } else {
    console.log('amount_usd exists in project_milestones!');
  }
}

checkSpecificColumns();
