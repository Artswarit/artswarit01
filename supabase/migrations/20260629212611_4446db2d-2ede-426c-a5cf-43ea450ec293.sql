-- Remove public/anon-readable email and recovery fields from `users` and `profiles`.
-- Anonymous reads now route through the existing security_invoker views
-- (public_users / public_profiles) which already exclude sensitive columns.

-- 1) Drop blanket-public policies on the base tables
DROP POLICY IF EXISTS "Allow public read users" ON public.users;
DROP POLICY IF EXISTS "Public can view safe profile columns" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can view profile directory" ON public.profiles;

-- 2) Tight authenticated-only directory access on the base tables
--    (the public views remain available for anonymous traffic).
CREATE POLICY "Authenticated can read users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can read profile directory"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- 3) Revoke anonymous SELECT on the base tables; keep view access only.
REVOKE SELECT ON public.users FROM anon;
REVOKE SELECT ON public.profiles FROM anon;

GRANT SELECT ON public.public_users TO anon, authenticated;
GRANT SELECT ON public.public_profiles TO anon, authenticated;
