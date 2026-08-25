-- These views expose only non-sensitive columns (no email, no payment data).
-- Running them as definer keeps public name/avatar resolution working now that
-- direct SELECT on users/profiles is restricted to owners and admins.
ALTER VIEW public.public_users SET (security_invoker = false);
ALTER VIEW public.public_profiles SET (security_invoker = false);

GRANT SELECT ON public.public_users TO anon, authenticated;
GRANT SELECT ON public.public_profiles TO anon, authenticated;