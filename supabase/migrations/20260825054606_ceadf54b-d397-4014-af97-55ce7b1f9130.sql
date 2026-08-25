-- Anonymous: safe columns only (already granted); make sure nothing table-wide.
REVOKE SELECT ON public.users FROM anon;
GRANT SELECT (id, name, role, bio, profile_pic_url, cover_photo_url, social_links, created_at, updated_at)
  ON public.users TO anon;

REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, full_name, avatar_url, role, bio, location, website, social_links,
              is_verified, created_at, updated_at, account_status, tags, portfolio_url,
              experience_years, hourly_rate, cover_url, country, city, currency, timezone,
              language, show_activity_stats, show_last_active, profile_visibility,
              last_active_at, avg_response_hours, is_on_vacation)
  ON public.profiles TO anon;

-- Signed-in users keep their previous access (settings pages and admin tools
-- read sensitive columns of their own row / of all rows when admin).
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;