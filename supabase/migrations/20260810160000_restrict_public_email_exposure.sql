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
