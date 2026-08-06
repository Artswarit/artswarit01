-- 1. Payout lock status used by release-milestone-payout edge function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'milestone_status_v2') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'milestone_status_v2' AND e.enumlabel = 'PROCESSING_PAYOUT'
    ) THEN
      ALTER TYPE public.milestone_status_v2 ADD VALUE 'PROCESSING_PAYOUT';
    END IF;
  END IF;
END $$;

-- 2. Public (anon) read access to non-sensitive profile columns only.
--    Row visibility is still enforced by the existing RLS policies on profiles/users.
GRANT SELECT (
  id, full_name, avatar_url, role, bio, location, website, social_links,
  is_verified, created_at, updated_at, account_status, tags, portfolio_url,
  experience_years, hourly_rate, cover_url, country, city, currency,
  timezone, language, show_activity_stats, show_last_active,
  profile_visibility, last_active_at, avg_response_hours, is_on_vacation
) ON public.profiles TO anon;

GRANT SELECT (
  id, name, role, bio, profile_pic_url, cover_photo_url, social_links,
  created_at, updated_at
) ON public.users TO anon;
