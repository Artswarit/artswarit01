-- Views back to invoker; safety now comes from column-level grants below.
ALTER VIEW public.public_users SET (security_invoker = true);
ALTER VIEW public.public_profiles SET (security_invoker = true);

-- users: no table-wide read for anon/authenticated, only safe columns.
REVOKE SELECT ON public.users FROM anon, authenticated;
GRANT SELECT (id, name, role, bio, profile_pic_url, cover_photo_url, social_links, created_at, updated_at)
  ON public.users TO anon, authenticated;
GRANT ALL ON public.users TO service_role;

DROP POLICY IF EXISTS "Public profile discovery" ON public.users;
CREATE POLICY "Public profile discovery"
ON public.users FOR SELECT TO anon, authenticated
USING (true);

-- profiles: same treatment for the columns the public profile view exposes.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, full_name, avatar_url, role, bio, location, website, social_links,
              is_verified, created_at, updated_at, account_status, tags, portfolio_url,
              experience_years, hourly_rate, cover_url, country, city, currency, timezone,
              language, show_activity_stats, show_last_active, profile_visibility,
              last_active_at, avg_response_hours, is_on_vacation)
  ON public.profiles TO anon, authenticated;
GRANT ALL ON public.profiles TO service_role;