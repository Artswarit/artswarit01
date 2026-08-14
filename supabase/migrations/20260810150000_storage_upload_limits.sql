-- ============================================================================
-- Server-side upload limits on storage buckets
-- ============================================================================
-- None of the buckets declared allowed_mime_types or file_size_limit, so the
-- only gating was client-side (`accept=` attributes and one `file.type`
-- check). Any user could bypass the UI and call storage.upload() directly with
-- their own JWT to store arbitrary file types at unbounded size -- notably
-- script-bearing HTML/SVG served from a public bucket URL, plus uncapped
-- storage-cost abuse.
--
-- Uses UPDATE rather than INSERT so this applies to whichever buckets actually
-- exist (some were created outside the tracked migrations) and is idempotent.
-- ============================================================================

-- --------------------------------------------------------------------------
-- Avatars: genuinely images only. Strict allowlist, small cap.
-- SVG is deliberately excluded throughout -- it can carry script and every one
-- of these buckets is publicly readable.
-- --------------------------------------------------------------------------
UPDATE storage.buckets
   SET file_size_limit = 5242880, -- 5 MB, matches update-user-profile's own check
       allowed_mime_types = ARRAY[
         'image/jpeg',
         'image/png',
         'image/webp',
         'image/gif',
         'image/avif'
       ]
 WHERE id = 'avatars';

-- --------------------------------------------------------------------------
-- Artwork / general media buckets.
--
-- CORRECTED: an earlier draft applied the image-only allowlist above to these
-- too. That would have broken a shipped feature -- ArtworkUploadForm.tsx:393
-- offers image / audio / video artwork types (accept="image/*" | "audio/*" |
-- "video/*") and useArtworks.ts:165 uploads all of them to the `artworks`
-- bucket, with media_type driving the audio/video players. An image-only
-- allowlist would have rejected every audio and video upload.
--
-- So the allowlist covers image, audio and video, which still closes the
-- script-bearing-file vector (no text/html, no image/svg+xml) while leaving the
-- feature intact. The size cap is raised accordingly, since video needs it.
-- --------------------------------------------------------------------------
UPDATE storage.buckets
   SET file_size_limit = 52428800, -- 50 MB
       allowed_mime_types = ARRAY[
         -- images
         'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
         -- audio
         'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg',
         'audio/aac', 'audio/flac', 'audio/x-m4a',
         -- video
         'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
         'video/ogg'
       ]
 WHERE id IN ('media', 'artworks', 'artwork_media');

-- --------------------------------------------------------------------------
-- Deliverable buckets (project files, milestone submissions).
--
-- Only a size cap is applied here. A MIME allowlist is deliberately NOT set:
-- artists legitimately deliver a wide and unpredictable range of formats
-- (PSD, AI, FIG, ZIP, video, fonts), and guessing that list would break real
-- deliveries. 50 MB matches the client-side cap already enforced in
-- MilestoneSubmissionDialog (MAX_FILE_SIZE_MB = 50).
--
-- FOLLOW-UP (needs a product decision): agree the accepted deliverable formats
-- and add an allowlist here. Until then `project-files` is publicly readable,
-- so a user could still host arbitrary content from it.
-- --------------------------------------------------------------------------
UPDATE storage.buckets
   SET file_size_limit = 52428800 -- 50 MB
 WHERE id IN ('project-files', 'milestone-submissions', 'messaging-attachments');
