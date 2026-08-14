-- Public discovery of approved, visible profiles (row-level; column access for anon
-- is already restricted to non-sensitive columns by explicit GRANTs).
DROP POLICY IF EXISTS "Public can view approved visible profiles" ON public.profiles;
CREATE POLICY "Public can view approved visible profiles"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  COALESCE(account_status, 'approved') = 'approved'
  AND COALESCE(profile_visibility, true) = true
);

DROP POLICY IF EXISTS "Public can view user directory" ON public.users;
CREATE POLICY "Public can view user directory"
ON public.users
FOR SELECT
TO anon, authenticated
USING (true);
