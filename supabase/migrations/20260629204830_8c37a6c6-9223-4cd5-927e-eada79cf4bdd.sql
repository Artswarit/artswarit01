
-- 1. project-files storage: drop the overly permissive read policy
DROP POLICY IF EXISTS "Users can view project files" ON storage.objects;

-- 2. project_milestones: drop USING (true) authenticated SELECT
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.project_milestones;

-- 3. user_roles: drop self-insert privilege escalation
DROP POLICY IF EXISTS "Users can insert their own roles" ON public.user_roles;

-- Admin-only insert/update/delete policy (service role bypasses RLS automatically)
DROP POLICY IF EXISTS "Admins manage user roles" ON public.user_roles;
CREATE POLICY "Admins manage user roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
