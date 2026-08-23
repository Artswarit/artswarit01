-- Public artwork discovery must not expose premium/exclusive content.
--
-- The only SELECT policy governing `public.artworks` for anonymous/public
-- readers is:
--   CREATE POLICY "Allow public read on public artworks" ON public.artworks
--     FOR SELECT USING (status = 'public');
--
-- That policy has no idea about `metadata->>'access_type'` (free / premium /
-- exclusive) — every "public" row, premium or not, is fully readable by
-- anyone, including the raw media_url. Filtering was only ever done in the
-- client (usePublicArtworks.ts filtered `access_type === 'free'` in JS after
-- fetching every public row), which is not a real access-control boundary:
-- anyone can call the REST endpoint directly with the anon key and skip the
-- client-side filter entirely.
--
-- We cannot simply tighten the existing RLS policy to exclude premium rows
-- outright, because ArtistProfile.tsx intentionally lists an artist's
-- premium/exclusive artworks (as locked preview cards) to logged-out and
-- non-purchasing visitors — RLS is row-level, not column-level, so a
-- stricter policy would also break that already-shipped, intentional
-- feature. Instead, the public discovery surfaces (Explore, "More to
-- Discover") get their own server-side, SECURITY DEFINER access-control
-- function that filters to free/public artworks before pagination — the
-- actual "Backend/API access-control filter" layer, not a frontend hide.

CREATE OR REPLACE FUNCTION public.get_public_artworks(
  p_limit int DEFAULT 12,
  p_offset int DEFAULT 0,
  p_exclude_id uuid DEFAULT NULL,
  p_category text DEFAULT NULL
)
RETURNS SETOF public.artworks
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.artworks
  WHERE status = 'public'
    -- Absence of access_type in metadata means 'free' (matches the app's
    -- existing default: `metadata?.access_type || 'free'`).
    AND (metadata ->> 'access_type' IS NULL OR metadata ->> 'access_type' = 'free')
    AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    AND (p_category IS NULL OR category = p_category)
  ORDER BY created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 0), 100)
  OFFSET GREATEST(p_offset, 0);
$$;

-- Public + authenticated callers both use this for browsing; it only ever
-- returns free/public rows regardless of who calls it or what parameters
-- they pass, so widening the caller set here does not widen data exposure.
GRANT EXECUTE ON FUNCTION public.get_public_artworks(int, int, uuid, text) TO anon, authenticated;
