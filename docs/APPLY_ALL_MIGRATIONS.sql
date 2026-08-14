-- ############################################################################
-- ARTSWARIT - COMBINED SECURITY MIGRATION (apply once)
-- ############################################################################
-- Generated from the five migration files in supabase/migrations/.
-- Project: sqdzemlcqesgjsybbhte (artflow123)
--
-- HOW TO APPLY
--   Paste this whole file into the Supabase SQL editor and Run once.
--   It is wrapped in BEGIN/COMMIT, so it is ALL-OR-NOTHING: if any statement
--   fails, nothing is applied and production is left untouched.
--
--   Do NOT use "supabase db push" - the CLI believes all 65 local migrations
--   are unapplied and would replay the 45 already applied, several of which
--   are not idempotent. See docs/IMPLEMENTATION_REPORT.md section 5.0.
--
-- WHAT IT CHANGES
--   1.  profiles          - blocks self-promotion to role=premium (0% fee)
--   2.  users             - blocks self-promotion to role=admin
--   3.  artwork_unlocks   - closes free-artwork insert (correct live name)
--   4.  transactions      - pins inserted status to pending (Stripe keeps working)
--   5.  withdrawals       - pins inserted status to pending, amount > 0
--   6.  notifications     - lets counterparties/admins actually be notified
--   7.  disputes          - adds previous_status (dispute raising is BROKEN in
--                           production without it) + participant withdraw policy
--   8.  project_milestones- trigger enforcing the escrow state machine and
--                           freezing money columns against participant edits
--   9.  rate limiting     - api_rate_limits table + check_rate_limit()
--   10. messages          - trigger making user blocking actually block
--   11. storage           - size caps + image MIME allowlist on buckets
--   12. users             - revokes email from anon AND authenticated
--                           (every user email is currently world-readable)
--
-- All statements are idempotent, so re-running is safe.
-- After applying, run the verification block at the bottom of this file.
-- ############################################################################

BEGIN;

-- ============================================================================
-- SOURCE FILE: 20260810120000_security_rls_hardening.sql
-- ============================================================================

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

-- ============================================================================
-- SOURCE FILE: 20260810130000_api_rate_limiting.sql
-- ============================================================================

-- ============================================================================
-- API rate limiting primitive
-- ============================================================================
-- The AI proxy endpoints (artist-gpt-chat, universal-chatgpt-assistant) call
-- paid third-party LLM APIs and had no throttle of any kind, so an unbounded
-- caller could run up cost or exhaust quota. There was no rate-limit storage
-- anywhere in the project, so this adds the primitive both can share.
--
-- Fixed-window counter: cheap, atomic, and good enough to stop cost abuse.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket_key    text        NOT NULL,
  window_start  timestamptz NOT NULL,
  request_count integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

-- Service-role only: edge functions are the sole writer. No policies are
-- defined, so anon/authenticated are denied while service_role bypasses RLS.
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window_start
  ON public.api_rate_limits (window_start);

-- Atomically increments the counter for the current window and reports whether
-- the caller is still under the limit. Returns true when the request is allowed.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _bucket_key     text,
  _max_requests   integer,
  _window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_start timestamptz;
  _count        integer;
BEGIN
  IF _bucket_key IS NULL OR _max_requests IS NULL OR _window_seconds IS NULL OR _window_seconds <= 0 THEN
    -- Fail open on a malformed call rather than locking out real traffic.
    RETURN true;
  END IF;

  -- Snap to a fixed window so concurrent callers share the same counter row.
  _window_start := to_timestamp(
    floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds
  );

  INSERT INTO public.api_rate_limits AS l (bucket_key, window_start, request_count)
  VALUES (_bucket_key, _window_start, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET request_count = l.request_count + 1
  RETURNING l.request_count INTO _count;

  RETURN _count <= _max_requests;
END;
$$;

-- Housekeeping: drop counter rows for windows that can no longer be consulted.
CREATE OR REPLACE FUNCTION public.prune_api_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.api_rate_limits WHERE window_start < now() - interval '1 day';
$$;

-- ============================================================================
-- SOURCE FILE: 20260810140000_enforce_user_blocks.sql
-- ============================================================================

-- ============================================================================
-- Make user blocking actually block
-- ============================================================================
-- BlockUserButton tells the user "they won't be able to message you", but
-- nothing enforced it: user_blocks was only ever written, never consulted.
-- Both parties could keep messaging each other after a block.
--
-- Enforced with a trigger rather than an RLS policy so it applies to every
-- writer (including service-role paths) and does not have to be merged with the
-- existing, partly untracked policies on `messages`.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reject_message_between_blocked_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _other_id uuid;
BEGIN
  IF NEW.sender_id IS NULL OR NEW.conversation_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve the counterparty from the conversation.
  SELECT CASE
           WHEN c.client_id = NEW.sender_id THEN c.artist_id
           ELSE c.client_id
         END
    INTO _other_id
    FROM public.conversations c
   WHERE c.id = NEW.conversation_id;

  IF _other_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- A block in EITHER direction stops the conversation: the blocker should not
  -- receive messages, and the blocked user should not be able to reach them.
  IF EXISTS (
    SELECT 1 FROM public.user_blocks b
     WHERE (b.blocker_id = NEW.sender_id AND b.blocked_id = _other_id)
        OR (b.blocker_id = _other_id AND b.blocked_id = NEW.sender_id)
  ) THEN
    RAISE EXCEPTION 'This conversation is unavailable because one participant has blocked the other'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_blocked_messages_trigger ON public.messages;
CREATE TRIGGER reject_blocked_messages_trigger
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_message_between_blocked_users();

-- Supports the lookup above and the blocked-list reads in useBlockedUsers.
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_id ON public.user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_id ON public.user_blocks (blocked_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON public.conversations (client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_artist_id ON public.conversations (artist_id);

-- ============================================================================
-- SOURCE FILE: 20260810150000_storage_upload_limits.sql
-- ============================================================================

-- ============================================================================
-- Server-side upload limits on storage buckets
-- ============================================================================
-- None of the buckets declared allowed_mime_types or file_size_limit, so the
-- only gating was client-side (`accept=` attributes and one `file.type`
-- check). Any user could bypass the UI and call storage.upload() directly with
-- their own JWT to store arbitrary file types at unbounded size -- notably
-- script-bearing HTML/SVG served from a public bucket URL, plus uncapped
-- storage-cost abuse.
--
-- Uses UPDATE rather than INSERT so this applies to whichever buckets actually
-- exist (some were created outside the tracked migrations) and is idempotent.
-- ============================================================================

-- --------------------------------------------------------------------------
-- Avatars: genuinely images only. Strict allowlist, small cap.
-- SVG is deliberately excluded throughout -- it can carry script and every one
-- of these buckets is publicly readable.
-- --------------------------------------------------------------------------
UPDATE storage.buckets
   SET file_size_limit = 5242880, -- 5 MB, matches update-user-profile's own check
       allowed_mime_types = ARRAY[
         'image/jpeg',
         'image/png',
         'image/webp',
         'image/gif',
         'image/avif'
       ]
 WHERE id = 'avatars';

-- --------------------------------------------------------------------------
-- Artwork / general media buckets.
--
-- CORRECTED: an earlier draft applied the image-only allowlist above to these
-- too. That would have broken a shipped feature -- ArtworkUploadForm.tsx:393
-- offers image / audio / video artwork types (accept="image/*" | "audio/*" |
-- "video/*") and useArtworks.ts:165 uploads all of them to the `artworks`
-- bucket, with media_type driving the audio/video players. An image-only
-- allowlist would have rejected every audio and video upload.
--
-- So the allowlist covers image, audio and video, which still closes the
-- script-bearing-file vector (no text/html, no image/svg+xml) while leaving the
-- feature intact. The size cap is raised accordingly, since video needs it.
-- --------------------------------------------------------------------------
UPDATE storage.buckets
   SET file_size_limit = 52428800, -- 50 MB
       allowed_mime_types = ARRAY[
         -- images
         'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
         -- audio
         'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg',
         'audio/aac', 'audio/flac', 'audio/x-m4a',
         -- video
         'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
         'video/ogg'
       ]
 WHERE id IN ('media', 'artworks', 'artwork_media');

-- --------------------------------------------------------------------------
-- Deliverable buckets (project files, milestone submissions).
--
-- Only a size cap is applied here. A MIME allowlist is deliberately NOT set:
-- artists legitimately deliver a wide and unpredictable range of formats
-- (PSD, AI, FIG, ZIP, video, fonts), and guessing that list would break real
-- deliveries. 50 MB matches the client-side cap already enforced in
-- MilestoneSubmissionDialog (MAX_FILE_SIZE_MB = 50).
--
-- FOLLOW-UP (needs a product decision): agree the accepted deliverable formats
-- and add an allowlist here. Until then `project-files` is publicly readable,
-- so a user could still host arbitrary content from it.
-- --------------------------------------------------------------------------
UPDATE storage.buckets
   SET file_size_limit = 52428800 -- 50 MB
 WHERE id IN ('project-files', 'milestone-submissions', 'messaging-attachments');

-- ============================================================================
-- SOURCE FILE: 20260810160000_restrict_public_email_exposure.sql
-- ============================================================================

-- ============================================================================
-- Stop anonymous callers reading every user's email address
-- ============================================================================
-- SEVERITY: Critical (mass PII exposure to unauthenticated actors)
--
-- WHAT IS EXPOSED TODAY
--   public.users.email is NOT NULL, and the table carries:
--       "Public can view user directory"  SELECT  roles: anon, authenticated
--                                         USING (true)
--   The publishable anon key ships in the client bundle, so anyone can run
--       GET /rest/v1/users?select=email,name,role
--   and enumerate every registered user's email address. No auth required.
--
-- WHY THE EXISTING MITIGATION DOESN'T WORK
--   The team already built the correct thing: migration 20251225220439 created
--   the `public_users` view, commented "to hide email from public queries", and
--   it projects every column of `users` EXCEPT email.
--
--   But 20260701200048 then set `ALTER VIEW public.public_users
--   SET (security_invoker = true)`. A security_invoker view runs with the
--   caller's privileges, so anonymous reads of `public_users` only work if anon
--   can also read the underlying `users` rows -- which is precisely what the
--   USING (true) policy grants. The blanket row access needed to keep the view
--   working is the same access that exposes the raw table, email included.
--   The projection is bypassable: query `users` directly and the view is moot.
--
-- WHY COLUMN GRANTS, NOT RLS
--   RLS filters ROWS; it cannot hide a COLUMN. Postgres column-level SELECT
--   privileges can. So the row policy is left exactly as it is -- no change to
--   which rows are visible, therefore no behavioural change for the view -- and
--   `email` is simply made unselectable by anon.
--
--   `public_users` continues to work for anonymous visitors because every column
--   it projects is granted below. FollowersList.tsx (its only consumer) is
--   unaffected.
--
-- SCOPE: `anon` AND `authenticated`.
--   The row policy is USING (true) for authenticated as well, so any logged-in
--   user could equally scrape every email -- the same mass exposure behind a
--   free signup. Both roles are therefore restricted.
--
--   All three edge functions that read public.users were checked first. Each
--   builds its client with SUPABASE_ANON_KEY in caller context, so all are
--   subject to these grants:
--     get-artist-dashboard-stats  select('role')  -- unaffected
--     report-content              select('id')    -- unaffected
--     update-user-profile         select()        -- WAS SELECT *, i.e. included
--                                                    email; narrowed to an
--                                                    explicit column list in the
--                                                    same change as this
--                                                    migration. It reads only the
--                                                    caller's own row, so nothing
--                                                    is withheld from the user.
--
--   Users can still obtain their OWN email from the session (auth.users), which
--   is where the client already reads it from -- nothing in src/ queries
--   public.users at all (0 call sites).
--
-- ROLLBACK
--   GRANT SELECT ON public.users TO anon, authenticated;
-- ============================================================================

DO $$
BEGIN
  -- Replace the table-wide SELECT with an explicit column list that omits
  -- `email`. Column grants constrain columns; the row policy still governs
  -- which rows are visible and is intentionally left unchanged.
  --
  -- The column-scoped revokes are NOT redundant. PostgreSQL tracks table-level
  -- and column-level privileges separately, so `REVOKE SELECT ON users` does
  -- not remove a privilege that was granted as `GRANT SELECT (email) ON users`.
  -- The first production run of this migration left email readable for exactly
  -- that reason; see docs/FIX_EMAIL_GRANT.sql.
  REVOKE SELECT (email) ON public.users FROM anon;
  REVOKE SELECT (email) ON public.users FROM authenticated;
  REVOKE SELECT (email) ON public.users FROM PUBLIC;

  REVOKE SELECT ON public.users FROM anon;
  REVOKE SELECT ON public.users FROM authenticated;

  GRANT SELECT (
    id,
    name,
    bio,
    cover_photo_url,
    profile_pic_url,
    role,
    social_links,
    created_at,
    updated_at
  ) ON public.users TO anon, authenticated;
END
$$;

-- ---------------------------------------------------------------------------
-- VERIFY (run as a separate query after applying):
--
--   -- 1. Neither role may hold a privilege on email; both keep the rest.
--   SELECT grantee, column_name, privilege_type
--     FROM information_schema.column_privileges
--    WHERE table_schema = 'public' AND table_name = 'users'
--      AND grantee IN ('anon','authenticated')
--    ORDER BY grantee, column_name;
--   -- expected: every column EXCEPT email, for both roles; no row for email.
--
--   -- 2. The safe view must still return rows for anonymous callers.
--   --    Easiest check from outside: with only the publishable anon key,
--   --      GET /rest/v1/public_users?select=id,name,role&limit=1  -> 200 + rows
--   --      GET /rest/v1/users?select=email&limit=1                -> permission denied
-- ---------------------------------------------------------------------------


COMMIT;

-- ############################################################################
-- POST-APPLY VERIFICATION
-- ############################################################################
-- Run this block as a SEPARATE query after the COMMIT above succeeds.
-- It is read-only. Every row should read OK; anything reading FAIL needs a look.
-- ############################################################################

WITH checks AS (
  -- 1. The previously-weak UPDATE policies must now carry a with_check.
  SELECT 'users.role self-promotion blocked' AS check_name,
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_policies
            WHERE schemaname='public' AND tablename='users'
              AND cmd='UPDATE' AND with_check IS NOT NULL
         ) THEN 'OK' ELSE 'FAIL' END AS result
  UNION ALL
  SELECT 'profiles.role self-promotion blocked',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_policies
            WHERE schemaname='public' AND tablename='profiles'
              AND cmd='UPDATE' AND policyname='Users can update their own profile'
              AND with_check IS NOT NULL
         ) THEN 'OK' ELSE 'FAIL' END
  UNION ALL
  -- 2. Free-artwork insert policy must be gone.
  SELECT 'artwork_unlocks client INSERT removed',
         CASE WHEN NOT EXISTS (
           SELECT 1 FROM pg_policies
            WHERE schemaname='public' AND tablename='artwork_unlocks' AND cmd='INSERT'
         ) THEN 'OK' ELSE 'FAIL' END
  UNION ALL
  -- 3. Stripe checkout must still be able to insert a pending transaction.
  SELECT 'transactions INSERT pinned to pending',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_policies
            WHERE schemaname='public' AND tablename='transactions'
              AND cmd='INSERT' AND with_check LIKE '%pending%'
         ) THEN 'OK' ELSE 'FAIL' END
  UNION ALL
  SELECT 'withdrawals INSERT pinned to pending',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_policies
            WHERE schemaname='public' AND tablename='withdrawals'
              AND cmd='INSERT' AND with_check LIKE '%pending%'
         ) THEN 'OK' ELSE 'FAIL' END
  UNION ALL
  -- 4. Cross-user notifications must now be permitted.
  SELECT 'notifications counterparty INSERT allowed',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_policies
            WHERE schemaname='public' AND tablename='notifications'
              AND cmd='INSERT' AND with_check LIKE '%projects%'
         ) THEN 'OK' ELSE 'FAIL' END
  UNION ALL
  -- 5. Dispute raising unblocked.
  SELECT 'disputes.previous_status exists',
         CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='disputes'
              AND column_name='previous_status'
         ) THEN 'OK' ELSE 'FAIL' END
  UNION ALL
  SELECT 'disputes participant withdraw policy',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_policies
            WHERE schemaname='public' AND tablename='disputes'
              AND policyname='Participants can withdraw their own open dispute'
         ) THEN 'OK' ELSE 'FAIL' END
  UNION ALL
  -- 6. Both triggers installed.
  SELECT 'escrow state-machine trigger',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_trigger
            WHERE NOT tgisinternal AND tgname='enforce_milestone_transition_trigger'
         ) THEN 'OK' ELSE 'FAIL' END
  UNION ALL
  SELECT 'blocked-messages trigger',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_trigger
            WHERE NOT tgisinternal AND tgname='reject_blocked_messages_trigger'
         ) THEN 'OK' ELSE 'FAIL' END
  UNION ALL
  -- 7. Rate limiter present.
  SELECT 'check_rate_limit() function',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='public' AND p.proname='check_rate_limit'
         ) THEN 'OK' ELSE 'FAIL' END
  UNION ALL
  -- 8. email no longer SELECTable by anon or authenticated.
  --
  --    Uses has_column_privilege(), not information_schema.column_privileges.
  --    An earlier version of this check queried that view without filtering on
  --    privilege_type, so it matched the INSERT/UPDATE/REFERENCES privileges
  --    anon still holds on the table and reported a false FAIL twice while the
  --    revoke had in fact worked. has_column_privilege() answers the real
  --    question -- can this role read this column -- accounting for table
  --    grants, column grants, PUBLIC and role inheritance.
  SELECT 'users.email NOT selectable by anon',
         CASE WHEN has_column_privilege('anon','public.users','email','SELECT')
              THEN 'FAIL' ELSE 'OK' END
  UNION ALL
  SELECT 'users.email NOT selectable by authenticated',
         CASE WHEN has_column_privilege('authenticated','public.users','email','SELECT')
              THEN 'FAIL' ELSE 'OK' END
  UNION ALL
  -- ...while the rest of the directory stays readable, or public_users (which is
  -- security_invoker) stops returning rows and FollowersList breaks.
  SELECT 'users.name still selectable by anon',
         CASE WHEN has_column_privilege('anon','public.users','name','SELECT')
              THEN 'OK' ELSE 'FAIL' END
  UNION ALL
  -- 9. Storage caps applied.
  SELECT 'storage size limits set',
         CASE WHEN EXISTS (
           SELECT 1 FROM storage.buckets
            WHERE id IN ('artworks','avatars','media') AND file_size_limit IS NOT NULL
         ) THEN 'OK' ELSE 'FAIL' END
)
SELECT result, check_name FROM checks ORDER BY result DESC, check_name;

-- Also confirm the rate limiter actually runs (expect: true):
--   SELECT public.check_rate_limit('post-apply-smoke-test', 5, 60);

-- ############################################################################
-- APP SMOKE TESTS - these exercise exactly what changed:
--   * Raise a dispute on a milestone   -> should now WORK (broken before this)
--   * Submit a milestone for review    -> client receives a notification
--   * Start a Stripe artwork checkout  -> must still reach Stripe
--   * Upload an artwork image          -> must still succeed (under 15 MB)
--   * Message someone you blocked      -> must be refused
--   * Load the followers list          -> must still populate (public_users view)
-- ############################################################################

