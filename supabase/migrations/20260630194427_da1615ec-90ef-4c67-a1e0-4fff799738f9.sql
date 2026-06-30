-- Drop the blanket authenticated SELECT policies that exposed sensitive
-- columns (email, recovery_phone, recovery_codes_hash) to every logged-in
-- user. Owner-scoped and admin policies remain in place, so users can
-- still read their own full row, and admins keep full access.
-- Directory / cross-user reads must go through the existing
-- public_profiles and public_users views, which exclude sensitive columns.

DROP POLICY IF EXISTS "Authenticated can read profile directory" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can read users" ON public.users;