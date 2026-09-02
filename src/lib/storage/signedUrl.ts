import { supabase } from "@/integrations/supabase/client";

/**
 * Private buckets are the default for anything user-scoped (project files,
 * milestone submissions, message attachments). Records in the database still
 * store a canonical URL that embeds the bucket + object path, so reads resolve
 * a short-lived signed URL from that stored value at display time.
 */
export function extractStoragePath(fileUrl: string, bucket: string): string | null {
  if (!fileUrl) return null;
  const marker = `/${bucket}/`;
  const index = fileUrl.indexOf(marker);
  if (index === -1) return null;
  const path = fileUrl.slice(index + marker.length).split("?")[0];
  return path ? decodeURIComponent(path) : null;
}

/**
 * Work out which of `candidates` a stored URL actually points at.
 *
 * Objects for one feature can be spread across buckets when the storage layout
 * changes — e.g. message attachments predating the private
 * `message-attachments` bucket still live in the public `media` one. Signing
 * against the wrong bucket silently yields the unsigned URL back, which only
 * appears to work while the old bucket is still public.
 */
export function inferStorageBucket(
  fileUrl: string | null | undefined,
  candidates: readonly string[]
): string | null {
  if (!fileUrl) return null;
  for (const bucket of candidates) {
    if (extractStoragePath(fileUrl, bucket)) return bucket;
  }
  return null;
}

export async function getSignedStorageUrl(
  fileUrl: string | null | undefined,
  bucket: string,
  expiresIn = 3600
): Promise<string> {
  if (!fileUrl) return "";
  const path = extractStoragePath(fileUrl, bucket);
  if (!path) return fileUrl;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    console.error(`Failed to create signed URL for ${bucket}:`, error);
    return fileUrl;
  }
  return data.signedUrl;
}

/**
 * Canonical, path-bearing reference stored in the database for an uploaded
 * object.
 *
 * Shaped like a public URL so `extractStoragePath` can recover the bucket and
 * key from it, but it is NOT guaranteed to be fetchable — private buckets will
 * reject it. Always resolve it through `getSignedStorageUrl` before putting it
 * in an `href`, `src`, or `window.open`. Call sites previously used
 * `storage.getPublicUrl()` for this, which reads as "this link works",
 * inviting exactly that mistake.
 */
export function buildStorageRef(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Resolve a stored reference and hand it to the browser in a new tab.
 * Returns false when signing failed, so callers can surface an error rather
 * than silently opening a URL that 400s.
 */
export async function openSignedStorageUrl(
  fileUrl: string | null | undefined,
  bucket: string,
  expiresIn = 3600
): Promise<boolean> {
  const signed = await getSignedStorageUrl(fileUrl, bucket, expiresIn);
  if (!signed) return false;
  window.open(signed, "_blank", "noopener,noreferrer");
  return true;
}
