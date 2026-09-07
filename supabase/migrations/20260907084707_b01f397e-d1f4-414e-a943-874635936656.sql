-- 1. Users table: remove blanket public read of emails/names
DROP POLICY IF EXISTS "Public profile discovery" ON public.users;
REVOKE SELECT ON public.users FROM anon;

-- 2. Storage: stop public reads of legacy message attachments in the shared 'media' bucket
DROP POLICY IF EXISTS "Public can read message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;

CREATE POLICY "Public read of media except message attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] <> 'message-attachments'
);

CREATE POLICY "Participants read legacy media message attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = 'message-attachments'
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE (c.client_id = auth.uid() AND c.artist_id::text = (storage.foldername(name))[2])
         OR (c.artist_id = auth.uid() AND c.client_id::text = (storage.foldername(name))[2])
    )
  )
);