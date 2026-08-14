-- ============================================================================
-- Production verification — SINGLE RESULT SET
-- ============================================================================
-- Read-only. Paste into the Supabase SQL editor and Run once.
--
-- The previous version of this file used separate statements, and the SQL
-- editor only returns the LAST one's results — so only the storage-bucket check
-- came back. Everything below is UNION ALL'd into one table so a single Run
-- returns all of it. Set "Limit" to 500 rows or higher before running.
--
-- ⚠️  DO NOT RUN `supabase db push`. See docs/IMPLEMENTATION_REPORT.md §5.0 —
-- the CLI sees all 65 local migrations as unapplied and would replay the 45
-- already applied, several of which are not idempotent.
--
-- ALREADY ANSWERED by the first run (do not need re-checking):
--   milestone-submissions -> PUBLIC  (deliverables world-readable — see report)
--   project-files         -> PUBLIC  (client material world-readable)
--   artworks/avatars/media-> PUBLIC  (expected)
--   all buckets           -> file_size_limit NULL, allowed_mime_types NULL
-- ============================================================================

WITH
-- §1 RLS status on the security-critical tables ------------------------------
rls AS (
  SELECT '1_RLS'::text AS section,
         c.relname::text AS item,
         CASE WHEN c.relrowsecurity THEN 'RLS ON' ELSE '*** RLS OFF ***' END
           || ' | policies=' || COUNT(p.polname)::text AS finding
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_policy p ON p.polrelid = c.oid
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND c.relname IN ('withdrawals','profiles','users','user_roles','artwork_unlocks',
                       'transactions','project_milestones','notifications','disputes',
                       'sales','tasks','artwork_likes','razorpay_orders',
                       'razorpay_payments','payments','messages','conversations',
                       'razorpay_accounts','subscribers','user_blocks')
   GROUP BY c.relname, c.relrowsecurity
),
-- §2 UPDATE policies with no WITH CHECK = any column can be rewritten -------
weak AS (
  SELECT '2_WEAK_UPDATE'::text,
         (tablename || '.' || policyname)::text,
         CASE WHEN with_check IS NULL
              THEN '*** UPDATE with NO with_check — any column rewritable ***'
              ELSE 'with_check present' END
    FROM pg_policies
   WHERE schemaname='public' AND cmd='UPDATE'
     AND tablename IN ('withdrawals','profiles','users','user_roles','transactions',
                       'project_milestones','disputes','razorpay_accounts','subscribers')
),
-- §3 Does withdrawals exist, and what governs its status? --------------------
wd AS (
  SELECT '3_WITHDRAWALS_COLS'::text, column_name::text, data_type::text
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='withdrawals'
),
wdpol AS (
  SELECT '3_WITHDRAWALS_POLICY'::text, (policyname||' ['||cmd||']')::text,
         COALESCE(qual,'(no using)')::text
    FROM pg_policies WHERE schemaname='public' AND tablename='withdrawals'
),
-- §4 Objects the four new migrations depend on -------------------------------
deps AS (
  SELECT '4_DEPENDENCY'::text, d.item::text,
         CASE WHEN d.present THEN 'present' ELSE '*** MISSING — migration will fail ***' END
    FROM (
      SELECT 'fn is_admin' AS item, EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='is_admin') AS present
      UNION ALL SELECT 'tbl sales',              EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sales')
      UNION ALL SELECT 'tbl tasks',              EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tasks')
      UNION ALL SELECT 'tbl razorpay_orders',    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='razorpay_orders')
      UNION ALL SELECT 'tbl razorpay_payments',  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='razorpay_payments')
      UNION ALL SELECT 'tbl artwork_likes',      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='artwork_likes')
      UNION ALL SELECT 'tbl user_blocks',        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_blocks')
      UNION ALL SELECT 'tbl messages',           EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='messages')
      UNION ALL SELECT 'tbl conversations',      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='conversations')
      UNION ALL SELECT 'col sales.artist_id',    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales' AND column_name='artist_id')
      UNION ALL SELECT 'col sales.buyer_id',     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sales' AND column_name='buyer_id')
      UNION ALL SELECT 'col ms.amount_paid',     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='project_milestones' AND column_name='amount_paid')
      UNION ALL SELECT 'col ms.amount_usd',      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='project_milestones' AND column_name='amount_usd')
      UNION ALL SELECT 'col ms.approved_at',     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='project_milestones' AND column_name='approved_at')
      UNION ALL SELECT 'col ms.payment_id',      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='project_milestones' AND column_name='payment_id')
      UNION ALL SELECT 'col disputes.raised_by', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='disputes' AND column_name='raised_by')
      UNION ALL SELECT 'col users.role',         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='role')
      UNION ALL SELECT 'col conv.client_id',     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='conversations' AND column_name='client_id')
      UNION ALL SELECT 'col conv.artist_id',     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='conversations' AND column_name='artist_id')
    ) d
),
-- §5 KNOWN LIVE RISK: dispute raising inserts previous_status ---------------
prev AS (
  SELECT '5_DISPUTE_PREV_STATUS'::text, 'disputes.previous_status'::text,
         CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                            WHERE table_schema='public' AND table_name='disputes'
                              AND column_name='previous_status')
              THEN 'present — dispute raising works'
              ELSE '*** MISSING — raising a dispute FAILS in production ***' END
),
-- §6 Milestone status: enum-validated or free text? -------------------------
mstat AS (
  SELECT '6_MILESTONE_STATUS'::text, (data_type||' / '||udt_name)::text,
         CASE WHEN udt_name='milestone_status_v2'
              THEN 'enum-validated'
              ELSE 'free text — DB does not validate status values' END
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='project_milestones' AND column_name='status'
),
enums AS (
  SELECT '6_ENUMS'::text, t.typname::text,
         string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)::text
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid=t.oid
    JOIN pg_namespace n ON n.oid=t.typnamespace
   WHERE n.nspname='public'
     AND t.typname IN ('milestone_status_v2','dispute_status','subscription_tier','app_role','user_role','artwork_status','transaction_status')
   GROUP BY t.typname
)
SELECT * FROM rls
UNION ALL SELECT * FROM weak
UNION ALL SELECT * FROM wd
UNION ALL SELECT * FROM wdpol
UNION ALL SELECT * FROM deps
UNION ALL SELECT * FROM prev
UNION ALL SELECT * FROM mstat
UNION ALL SELECT * FROM enums
ORDER BY 1, 2;
