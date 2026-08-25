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
