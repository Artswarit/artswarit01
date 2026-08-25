-- Private message attachment bucket policies
DROP POLICY IF EXISTS "Users upload own message attachments" ON storage.objects;
CREATE POLICY "Users upload own message attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

DROP POLICY IF EXISTS "Conversation participants read message attachments" ON storage.objects;
CREATE POLICY "Conversation participants read message attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE (c.client_id = auth.uid() AND (c.artist_id)::text = (storage.foldername(name))[1])
         OR (c.artist_id = auth.uid() AND (c.client_id)::text = (storage.foldername(name))[1])
    )
  )
);

DROP POLICY IF EXISTS "Users delete own message attachments" ON storage.objects;
CREATE POLICY "Users delete own message attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Stop exposing user emails to anonymous visitors
DROP POLICY IF EXISTS "Public can view user directory" ON public.users;
REVOKE SELECT ON public.users FROM anon;

DROP POLICY IF EXISTS "Users can view their own user row" ON public.users;
CREATE POLICY "Users can view their own user row"
ON public.users FOR SELECT TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all user rows" ON public.users;
CREATE POLICY "Admins can view all user rows"
ON public.users FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));