-- ============================================================================
-- Close two outstanding exposures
--   1. public.users / public.profiles leak every user's email to any
--      signed-in account.
--   2. Message attachments remain world-readable via the public `media`
--      bucket.
-- ============================================================================
--
-- !! NOT YET APPLIED — see the VERIFICATION section at the bottom before
-- !! pushing. This file is written against the migration history, which is
-- !! known to diverge from production (15 local migrations are unapplied, and
-- !! at least one production object -- the enforce_milestone_transition
-- !! trigger -- exists in prod without a corresponding applied migration).
--
-- ---------------------------------------------------------------------------
-- 1. Email exposure
-- ---------------------------------------------------------------------------
-- 20260825054440 correctly narrowed anon+authenticated to a safe column list
-- and left row visibility wide open via the "Public profile discovery" policy
-- (USING (true)). Safety there rests entirely on the column grants.
--
-- 20260825054606, four minutes later, then ran:
--     GRANT SELECT ON public.users TO authenticated;
--     GRANT SELECT ON public.profiles TO authenticated;
-- Table-wide grants restore *every* column, `email` included. Combined with
-- USING (true), any authenticated user can read the email address of every
-- account -- i.e. the whole user base is one authenticated request away.
--
-- Fix: mirror the anon treatment for authenticated -- safe columns only --
-- and route the two legitimate email readers through explicit, gated paths.
-- ---------------------------------------------------------------------------

REVOKE SELECT ON public.users FROM authenticated;
GRANT SELECT (id, name, role, bio, profile_pic_url, cover_photo_url,
              social_links, created_at, updated_at)
  ON public.users TO authenticated;

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, avatar_url, role, bio, location, website,
              social_links, is_verified, created_at, updated_at,
              account_status, tags, portfolio_url, experience_years,
              hourly_rate, cover_url, country, city, currency, timezone,
              language, show_activity_stats, show_last_active,
              profile_visibility, last_active_at, avg_response_hours,
              is_on_vacation)
  ON public.profiles TO authenticated;

-- Own row, all columns. SECURITY DEFINER so it can see `email` despite the
-- column grants above, but it is hard-filtered to auth.uid() and therefore
-- cannot return anyone else's row.
-- Replaces the read in src/hooks/useArtworks.ts (own profile only).
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (id uuid, full_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- Admin directory. SECURITY DEFINER, gated on is_admin(); a non-admin caller
-- gets zero rows rather than an error, so the admin page degrades quietly.
-- Replaces the read in src/components/admin/UserGovernance.tsx.
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  role text,
  account_status text,
  avatar_url text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email, p.role::text, p.account_status,
         p.avatar_url, p.created_at
  FROM public.profiles p
  WHERE public.is_admin(auth.uid())
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Message attachments in the public `media` bucket
-- ---------------------------------------------------------------------------
-- `media` was created public (20250922122725). Attachments written before the
-- switch to `message-attachments` still live there, so anyone holding or
-- guessing an object path can read a private conversation's files with no
-- auth at all.
--
-- Flipping the bucket private is the fix. The client is already prepared:
-- MessageAttachments resolves stored URLs through inferStorageBucket() across
-- both buckets, so legacy `media` attachments get signed rather than fetched
-- directly. THAT FRONTEND CHANGE MUST SHIP FIRST -- otherwise every legacy
-- attachment 400s the moment this runs.
-- ---------------------------------------------------------------------------

UPDATE storage.buckets SET public = false WHERE id = 'media';

-- Reads now require a signed URL, which storage only issues to a caller whose
-- RLS check passes. Scope to conversation participants via the owner-prefixed
-- path convention (`<user_id>/<file>`) already used at upload time.
DROP POLICY IF EXISTS "Media readable by owner" ON storage.objects;
CREATE POLICY "Media readable by owner"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Counterparties must still be able to open what was sent to them. A message
-- attachment is readable by the other participant of a conversation the
-- sender belongs to.
DROP POLICY IF EXISTS "Media readable by conversation participant" ON storage.objects;
CREATE POLICY "Media readable by conversation participant"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'media'
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE (c.client_id = auth.uid() OR c.artist_id = auth.uid())
      AND (storage.foldername(name))[1] IN (c.client_id::text, c.artist_id::text)
  )
);

-- ============================================================================
-- VERIFICATION -- run BEFORE and AFTER applying
-- ============================================================================
-- Current state (must be checked against prod, not against this repo):
--
--   select grantee, privilege_type, column_name
--     from information_schema.column_privileges
--    where table_name in ('users','profiles') and grantee in ('anon','authenticated')
--    order by grantee, table_name, column_name;
--
--   select tablename, policyname, roles, qual
--     from pg_policies where tablename in ('users','profiles');
--
--   select id, public from storage.buckets where id = 'media';
--
-- After applying, the leak should be closed for a *signed-in* caller:
--
--   GET /rest/v1/profiles?select=email&limit=1
--     Authorization: Bearer <any non-admin user JWT>
--   -> expect 42501 permission denied (currently: 200 + every email)
--
--   GET /rest/v1/profiles?select=id,full_name&limit=1   -> still 200
--   POST /rest/v1/rpc/get_my_profile                    -> own row only
--   POST /rest/v1/rpc/admin_list_users  (non-admin JWT) -> []
--   POST /rest/v1/rpc/admin_list_users  (admin JWT)     -> all rows
--
-- And for storage:
--   curl <supabase>/storage/v1/object/public/media/<known path>  -> 400/404
--   signed URL for the same object, as a participant             -> 200
-- ============================================================================
