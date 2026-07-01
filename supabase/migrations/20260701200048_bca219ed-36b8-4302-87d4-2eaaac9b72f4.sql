-- Replace elevated public views with security-invoker views
ALTER VIEW public.public_profiles SET (security_invoker = true);
ALTER VIEW public.public_users SET (security_invoker = true);

-- Allow public profile discovery without SECURITY DEFINER views.
DROP POLICY IF EXISTS "Public can view approved visible profiles" ON public.profiles;
CREATE POLICY "Public can view approved visible profiles"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  profile_visibility IS TRUE
  AND account_status = 'approved'
);

DROP POLICY IF EXISTS "Public can view public users" ON public.users;
CREATE POLICY "Public can view public users"
ON public.users
FOR SELECT
TO anon, authenticated
USING (true);

-- Prevent client-side escalation of subscription/payment fields.
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscribers;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscribers;
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON public.subscribers;
DROP POLICY IF EXISTS "Service role manages subscriptions" ON public.subscribers;

CREATE POLICY "Users can view own subscription"
ON public.subscribers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service role manages subscriptions"
ON public.subscribers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

GRANT SELECT ON public.subscribers TO authenticated;
GRANT ALL ON public.subscribers TO service_role;