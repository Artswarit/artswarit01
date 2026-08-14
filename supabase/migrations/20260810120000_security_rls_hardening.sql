-- ============================================================================
-- Security hardening: close privilege-escalation and payment-forgery holes
-- ============================================================================
-- Findings addressed (see docs/COMPREHENSIVE_AUDIT_2026-08.md §0):
--   1. RLS never enabled on user_roles / razorpay_orders / razorpay_payments /
--      sales / tasks / artwork_likes -- policies (where they existed) were inert.
--   2. public.users UPDATE policy had no WITH CHECK -> self-promotion to admin.
--   3. public.transactions INSERT let a buyer forge a status='success' row.
--   4. public.artwork_unlocks INSERT was WITH CHECK (true) -> free artwork.
--   5. project_milestones UPDATE had no WITH CHECK -> escrow state/amount
--      tampering, including marking a milestone COMPLETED without a payout.
--   6. disputes had no participant UPDATE policy, so the in-app "withdraw
--      dispute" action silently affected 0 rows.
--
-- Every change below was checked against actual client call sites so that no
-- legitimate flow is broken. Where a table is read by the app, an explicit
-- SELECT policy is added in the same statement that enables RLS.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1-4. REMOVED after verifying against production (2026-08-11).
--
--    This section previously ran `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on
--    user_roles / razorpay_orders / razorpay_payments / tasks / sales /
--    artwork_likes, and added SELECT/INSERT/DELETE policies to sales and
--    artwork_likes, on the audit's finding that RLS had never been enabled for
--    them (no ENABLE statement appears in any migration file).
--
--    That finding was WRONG. Production shows RLS already ON for all of them,
--    each with policies (enabled out-of-band, like much of this schema):
--      user_roles 2 · razorpay_orders 3 · razorpay_payments 2
--      sales 2 · tasks 3 · artwork_likes 3 · withdrawals 2
--
--    The ENABLE statements would have been harmless no-ops, but the policy
--    additions would NOT: RLS permissive policies are OR'ed together, so adding
--    "Anyone can read artwork likes USING (true)" beside the existing three
--    would have WIDENED read access rather than restricting it. Same risk for
--    the sales SELECT policy. Dropped entirely -- these tables are already
--    protected and need no change here.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 5. public.users -- block self-promotion. The original policy had USING but no
--    WITH CHECK, so `UPDATE users SET role='admin' WHERE id=auth.uid()` worked.
--    The role must stay exactly what it already is on a self-update.
--    CONFIRMED LIVE: production policy "Allow user to update own profile" has
--    with_check = NULL.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow user to update own profile" ON public.users;
CREATE POLICY "Allow user to update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT u.role FROM public.users u WHERE u.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 5b. public.profiles -- the SAME missing-WITH_CHECK hole, and worse.
--
--     Found only by verifying production: the policy "Users can update their
--     own profile" has with_check = NULL. The audit flagged `users.role` but
--     missed this one, and `profiles.role` is the role the application actually
--     reads (useProfile -> useUserRole; `users` is the parallel legacy table).
--
--     Impact: any user can run
--        UPDATE profiles SET role = 'premium' WHERE id = auth.uid();
--     'premium' is the Pro-artist tier that grants a 0% platform fee, so this
--     is a direct route to free commissions -- an economic escalation, not just
--     a permissions one. 'artist' would likewise flip a client account into an
--     artist one.
--
--     Preserves the production policy name so this REPLACES it rather than
--     adding a second permissive policy beside it.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 6. transactions -- a buyer can insert their own row with status='success' and
--    fabricate a completed purchase. Production policy confirmed as
--    "Allow buyers to create transactions" INSERT WITH CHECK (auth.uid() =
--    buyer_id) -- no constraint on `status`, which is a transaction_status enum
--    with a 'success' member.
--
--    IMPORTANT: this policy cannot simply be dropped. create-checkout-session
--    builds its client with SUPABASE_ANON_KEY plus the caller's session (not the
--    service role), so its pending-transaction insert runs through RLS *as the
--    user*. Removing the policy would break Stripe checkout for artwork and
--    milestones alike.
--
--    Instead, pin the inserted status to 'pending' -- exactly what the
--    legitimate flow writes. Promotion to 'success' happens only in
--    stripe-webhook-handler, which uses the service role and bypasses RLS.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow buyers to create transactions" ON public.transactions;
CREATE POLICY "Allow buyers to create transactions"
  ON public.transactions
  FOR INSERT
  WITH CHECK (auth.uid() = buyer_id AND status = 'pending');

-- ---------------------------------------------------------------------------
-- 7. artwork_unlocks -- FREE ARTWORK. Any authenticated user can insert an
--    unlock row for any artwork and read paid content without paying.
--
--    CORRECTED POLICY NAME. This migration originally dropped
--    "Service role can insert unlocks" -- the name in this repo's migration
--    files. Production actually carries:
--        "Users can insert their own artwork unlocks"
--        INSERT, role authenticated, WITH CHECK (auth.uid() = user_id)
--    so the original DROP would have matched nothing, silently left the hole
--    open, and still reported success.
--
--    The live WITH CHECK is marginally tighter than the audit described (a user
--    can only unlock *for themselves*, not on someone else's behalf) but the
--    hole is the same: nothing ties the row to a payment, so
--        INSERT INTO artwork_unlocks (artwork_id, user_id)
--        VALUES ('<any artwork>', auth.uid());
--    grants free access to any paid artwork.
--
--    Safe to drop outright: client code only SELECTs this table, and every
--    writer (verify-artwork-payment, stripe-webhook-handler, the razorpay-webhook
--    fallback) uses the service role, which bypasses RLS.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own artwork unlocks" ON public.artwork_unlocks;
-- Also drop the repo-file name, in case some environment does use it.
DROP POLICY IF EXISTS "Service role can insert unlocks" ON public.artwork_unlocks;

-- ---------------------------------------------------------------------------
-- 7b. withdrawals -- insert-time forgery of an approved payout.
--
--     Production has no UPDATE policy (so a row cannot be edited after the
--     fact, which is why this is not a self-approval hole), but the INSERT
--     policy is WITH CHECK (auth.uid() = user_id) with no constraint on
--     `status` -- and `status` is plain text with no CHECK constraint. A user
--     can therefore create a withdrawal that is already marked approved/paid,
--     for an arbitrary amount.
--
--     Whether that triggers a real payout depends on the (out-of-repo) payout
--     process; at minimum it corrupts financial reporting. Pin the status on
--     insert; only the service role can advance it.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create withdrawals" ON public.withdrawals;
CREATE POLICY "Users can create withdrawals"
  ON public.withdrawals
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND COALESCE(status, 'pending') = 'pending'
    AND amount > 0
  );

-- ---------------------------------------------------------------------------
-- 7c. notifications -- cross-user notifications are silently failing today.
--
--     The audit claimed this policy was WITH CHECK (true), i.e. anyone could
--     forge a notification to anyone. Production is the OPPOSITE and too tight:
--         "Users can create their own notifications"
--         INSERT, authenticated, WITH CHECK (auth.uid() = user_id)
--     A user may only notify THEMSELVES.
--
--     Every notification the app sends to the other party therefore fails an
--     RLS check and is discarded. That covers the pre-existing inserts in
--     ProjectManagement.tsx and ClientDashboard.tsx (project accepted/rejected
--     etc.), the admin notices in UserGovernance / ContentModeration /
--     UserWarningsManagement / DisputeSettlement, and the three notifications
--     added in this batch (milestone submitted, revision requested, dispute
--     raised). All are wrapped in try/catch or unchecked, so they fail quietly
--     -- which is why the gap was invisible.
--
--     Widen it exactly enough: you may notify yourself, someone you share a
--     project with, or -- if you are an admin -- anyone. A project counterparty
--     can already message you directly, so this grants no new reach; it just
--     stops legitimate workflow notifications being thrown away.
--
--     (The stricter long-term design is server-side creation via a
--     SECURITY DEFINER function or trigger, so notification text isn't
--     client-supplied at all. That's a larger change; this unblocks the
--     feature without touching a single call site.)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create their own notifications" ON public.notifications;
CREATE POLICY "Users can create their own notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.projects p
       WHERE (p.client_id = auth.uid() AND p.artist_id = user_id)
          OR (p.artist_id = auth.uid() AND p.client_id = user_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 8. disputes.
--
--    8a. PREREQUISITE. DisputeDialog *inserts* previous_status when a dispute is
--    raised (DisputeDialog.tsx:108) and selects it on withdraw (:219). That
--    column is added by 20260716000000_audit_fixes.sql, which appears NOT to be
--    applied to production -- `supabase migration list --linked` shows no
--    counterpart for it, and the generated types.ts (which is produced FROM the
--    live database) does not contain the column.
--
--    If it is genuinely absent, raising a dispute fails outright in production,
--    because the INSERT references a column that does not exist. This is
--    idempotent, so it is a no-op if audit_fixes did land. Run
--    docs/VERIFY_PRODUCTION_RLS.sql §5 to confirm which case you are in.
-- ---------------------------------------------------------------------------
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS previous_status TEXT;

-- ---------------------------------------------------------------------------
--    8b. Participants can raise a dispute (INSERT policy exists) but there was
--    no UPDATE policy for them, so DisputeDialog's "withdraw" silently matched
--    0 rows while the paired milestone revert succeeded, leaving the dispute
--    permanently open. Allow a participant to withdraw their OWN still-open
--    dispute; admin resolution stays admin-only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants can withdraw their own open dispute" ON public.disputes;
CREATE POLICY "Participants can withdraw their own open dispute"
  ON public.disputes
  FOR UPDATE
  TO authenticated
  USING (raised_by = auth.uid() AND status = 'open')
  WITH CHECK (raised_by = auth.uid() AND status IN ('resolved', 'open'));

-- ---------------------------------------------------------------------------
-- 9. project_milestones -- escrow state machine enforcement.
--
--    RLS WITH CHECK can only inspect the NEW row, so a trigger is required to
--    compare OLD -> NEW and reject illegal transitions and money-column edits.
--    Server-side callers (edge functions using the service role, where
--    auth.uid() IS NULL) and admins are exempt; they are the only actors
--    allowed to move a milestone into COMPLETED or WAITING_FUNDS, which is
--    what release-milestone-payout / verify-razorpay-payment already do.
--
--    Allowed end-user transitions mirror the shipped UI exactly:
--      ACTIVE             -> REVIEW_PENDING   (artist submits work)
--      REVISION_REQUESTED -> REVIEW_PENDING   (artist resubmits)
--      REVISION_REQUESTED -> ACTIVE           (artist resumes)
--      REVIEW_PENDING     -> REVISION_REQUESTED (client requests changes)
--      any non-terminal    -> DISPUTED         (either party raises a dispute)
--      DISPUTED           -> ACTIVE | REVIEW_PENDING | REVISION_REQUESTED
--                                              (dispute withdrawn, reverts)
--      X -> X                                  (no-op writes to other columns,
--                                               incl. COMPLETED final uploads)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_milestone_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_status text := OLD.status::text;
  new_status text := NEW.status::text;
BEGIN
  -- Server-side (service role) has no auth.uid(); admins are trusted too.
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Escrow/money columns are server-owned. Silently allowing these to change
  -- let a participant rewrite the amount owed or fake a payout reference.
  IF NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.amount_paid IS DISTINCT FROM OLD.amount_paid
     OR NEW.amount_usd IS DISTINCT FROM OLD.amount_usd
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.payment_id IS DISTINCT FROM OLD.payment_id
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
  THEN
    RAISE EXCEPTION 'Milestone payment fields can only be changed by the payment system'
      USING ERRCODE = '42501';
  END IF;

  IF old_status = new_status THEN
    RETURN NEW;
  END IF;

  -- COMPLETED is terminal and may only be entered by the payout function.
  IF new_status = 'COMPLETED' THEN
    RAISE EXCEPTION 'A milestone is marked complete by releasing its payout, not directly'
      USING ERRCODE = '42501';
  END IF;

  IF old_status = 'COMPLETED' THEN
    RAISE EXCEPTION 'A completed milestone cannot be reopened'
      USING ERRCODE = '42501';
  END IF;

  -- Funding states are set by the payment system only.
  IF new_status IN ('WAITING_FUNDS', 'LOCKED') THEN
    RAISE EXCEPTION 'Milestone funding state is controlled by the payment system'
      USING ERRCODE = '42501';
  END IF;

  IF NOT (
       (old_status = 'ACTIVE'             AND new_status IN ('REVIEW_PENDING', 'DISPUTED'))
    OR (old_status = 'REVIEW_PENDING'     AND new_status IN ('REVISION_REQUESTED', 'DISPUTED'))
    OR (old_status = 'REVISION_REQUESTED' AND new_status IN ('ACTIVE', 'REVIEW_PENDING', 'DISPUTED'))
    OR (old_status = 'DISPUTED'           AND new_status IN ('ACTIVE', 'REVIEW_PENDING', 'REVISION_REQUESTED'))
  ) THEN
    RAISE EXCEPTION 'Illegal milestone transition: % -> %', old_status, new_status
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_milestone_transition_trigger ON public.project_milestones;
CREATE TRIGGER enforce_milestone_transition_trigger
  BEFORE UPDATE ON public.project_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_milestone_transition();

-- ---------------------------------------------------------------------------
-- 10. Indexes backing the RLS predicates above and the hottest project queries.
--     Every RLS check on these tables previously forced a sequential scan.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects (client_id);
CREATE INDEX IF NOT EXISTS idx_projects_artist_id ON public.projects (artist_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id ON public.project_milestones (project_id);
CREATE INDEX IF NOT EXISTS idx_artwork_likes_artwork_id ON public.artwork_likes (artwork_id);
CREATE INDEX IF NOT EXISTS idx_artwork_likes_user_id ON public.artwork_likes (user_id);
CREATE INDEX IF NOT EXISTS idx_artwork_unlocks_user_id ON public.artwork_unlocks (user_id);
CREATE INDEX IF NOT EXISTS idx_artwork_unlocks_artwork_id ON public.artwork_unlocks (artwork_id);
CREATE INDEX IF NOT EXISTS idx_sales_buyer_id ON public.sales (buyer_id);
CREATE INDEX IF NOT EXISTS idx_sales_artist_id ON public.sales (artist_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
