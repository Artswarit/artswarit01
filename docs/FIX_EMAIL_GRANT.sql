-- ############################################################################
-- FOLLOW-UP FIX — users.email still selectable by anon/authenticated
-- ############################################################################
-- The combined migration applied cleanly (13/14 checks OK), but this one failed:
--     users.email revoked from anon+authenticated -> FAIL
--
-- CAUSE
--   `REVOKE SELECT ON public.users FROM anon` removes the TABLE-level privilege
--   only. PostgreSQL tracks column-level privileges separately, so a grant made
--   as `GRANT SELECT (email) ON users TO ...` is untouched by a table-level
--   revoke and must be revoked with the same column syntax.
--
--   The previous run's `GRANT SELECT (id, name, ...)` did work -- the
--   "users.name still readable by anon" check passed -- so the DO block executed
--   correctly. Only the revoke was too coarse.
--
-- ############################################################################
-- STEP 1 — DIAGNOSE (read-only). Run this first and read the output.
-- ############################################################################

SELECT grantee, column_name, privilege_type
  FROM information_schema.column_privileges
 WHERE table_schema = 'public'
   AND table_name   = 'users'
   AND column_name  = 'email'
 ORDER BY grantee;

-- INTERPRET:
--   * rows for 'anon' and/or 'authenticated'  -> STEP 2 fixes it.
--   * a row for 'PUBLIC'                      -> the privilege is inherited by
--       every role. STEP 2 also revokes from PUBLIC to cover this.
--   * NO rows at all                          -> the privilege is already gone
--       and the earlier check was reporting a stale/derived row; re-run the
--       verification and stop here.


-- ############################################################################
-- STEP 2 — APPLY. Column-scoped revoke, which is what was missing.
-- ############################################################################
-- Safe: it removes read access to ONE column. It does not touch rows, policies,
-- other columns, or any other table. Wrapped so it is all-or-nothing.
--
-- Reminder of why this is safe for the app:
--   * nothing in src/ queries public.users at all (0 call sites)
--   * public_users (the view the app does use) does not project email
--   * all three edge functions touching users select only role / id / an
--     explicit column list -- none select email
--   * users still read their own email from the session (auth.users)

BEGIN;

REVOKE SELECT (email) ON public.users FROM anon;
REVOKE SELECT (email) ON public.users FROM authenticated;
REVOKE SELECT (email) ON public.users FROM PUBLIC;

-- Belt-and-braces: re-assert the table-level revoke, then re-grant exactly the
-- non-email columns. Idempotent; harmless if already in this state.
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

COMMIT;


-- ############################################################################
-- STEP 3 — RE-VERIFY. Expect both rows to read OK.
-- ############################################################################

SELECT
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM information_schema.column_privileges
     WHERE table_schema='public' AND table_name='users' AND column_name='email'
       AND grantee IN ('anon','authenticated','PUBLIC')
  ) THEN 'OK' ELSE 'FAIL' END                       AS result,
  'users.email not selectable by anon/authenticated' AS check_name
UNION ALL
SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.column_privileges
     WHERE table_schema='public' AND table_name='users' AND column_name='name'
       AND grantee='anon'
  ) THEN 'OK' ELSE 'FAIL' END,
  'users.name still readable by anon (view must keep working)';

-- ############################################################################
-- STEP 4 — CONFIRM FROM OUTSIDE (the check that actually matters).
-- Using only the publishable anon key from the client bundle:
--
--   curl "https://sqdzemlcqesgjsybbhte.supabase.co/rest/v1/users?select=email&limit=1" \
--        -H "apikey: <VITE_SUPABASE_PUBLISHABLE_KEY>"
--     -> expect an error / permission denied, NOT a list of email addresses.
--
--   curl "https://sqdzemlcqesgjsybbhte.supabase.co/rest/v1/public_users?select=id,name&limit=1" \
--        -H "apikey: <VITE_SUPABASE_PUBLISHABLE_KEY>"
--     -> expect 200 with rows (this is what FollowersList.tsx relies on).
-- ############################################################################
