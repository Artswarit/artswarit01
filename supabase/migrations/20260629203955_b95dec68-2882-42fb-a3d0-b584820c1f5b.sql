
-- 1. PROFILES: remove unconditional public SELECT and replace with column-scoped public read
DROP POLICY IF EXISTS "Allow public read profiles" ON public.profiles;

-- Revoke broad anon SELECT, then re-grant only safe columns
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, full_name, avatar_url, role, bio, location, website, social_links,
  is_verified, tags, portfolio_url, experience_years, hourly_rate, cover_url,
  country, city, currency, timezone, language, last_active_at,
  avg_response_hours, is_on_vacation, account_status, created_at, updated_at
) ON public.profiles TO anon;

-- Authenticated keeps full row SELECT capability but governed by RLS below
GRANT SELECT ON public.profiles TO authenticated;

CREATE POLICY "Public can view safe profile columns"
  ON public.profiles
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated can view profile directory"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. VIEWS: switch to security_invoker and strip sensitive columns
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
  WITH (security_invoker = true) AS
SELECT
  p.id, p.full_name, p.avatar_url, p.role, p.bio, p.location, p.website,
  p.social_links, p.is_verified, p.created_at, p.updated_at, p.account_status,
  p.tags, p.portfolio_url, p.experience_years, p.hourly_rate, p.cover_url,
  p.country, p.city, p.currency, p.timezone, p.language,
  p.show_activity_stats, p.show_last_active, p.profile_visibility,
  p.last_active_at, p.avg_response_hours, p.is_on_vacation
FROM public.profiles p;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

DROP VIEW IF EXISTS public.public_users;
CREATE VIEW public.public_users
  WITH (security_invoker = true) AS
SELECT
  u.id, u.name, u.role, u.bio, u.profile_pic_url, u.cover_photo_url,
  u.social_links, u.created_at, u.updated_at
FROM public.users u;

GRANT SELECT ON public.public_users TO anon, authenticated;

-- 3. STORAGE: lock milestone-submissions reads to project participants/admins
DROP POLICY IF EXISTS "Project participants can view submission files" ON storage.objects;

CREATE POLICY "Project participants can view submission files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'milestone-submissions'
    AND (
      -- Uploader (artist) — folder layout: <artist_id>/<project_id>/...
      (storage.foldername(name))[1] = (auth.uid())::text
      -- Project client/artist participants
      OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id::text = (storage.foldername(name))[2]
          AND (p.client_id = auth.uid() OR p.artist_id = auth.uid())
      )
      -- Admins
      OR public.is_admin(auth.uid())
    )
  );
