/**
 * Per-file byte-level upload helper for Supabase Storage.
 *
 * The Supabase JS SDK's `.upload()` uses `fetch`, which cannot report
 * upload progress. To surface real byte progress in the UI we:
 *
 *   1. Ask Supabase for a one-shot signed upload URL.
 *   2. PUT the file with `XMLHttpRequest` so we can listen to
 *      `xhr.upload.onprogress`.
 *
 * If signing fails (older buckets, permission edge cases) we transparently
 * fall back to the standard SDK upload and emit 0% / 100% events.
 */
import { supabase } from "@/integrations/supabase/client";

export interface UploadProgress {
  loaded: number;
  total: number;
  /** Integer 0–100. */
  percent: number;
}

export interface UploadWithProgressOptions {
  bucket: string;
  path: string;
  file: File;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
  contentType?: string;
  upsert?: boolean;
}

export interface UploadWithProgressResult {
  path: string;
}

const clampPercent = (loaded: number, total: number): number => {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
};

async function uploadViaSignedUrl(
  opts: UploadWithProgressOptions,
): Promise<UploadWithProgressResult> {
  const { bucket, path, file, onProgress, signal, contentType, upsert } = opts;

  const { data: signed, error: signError } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path, upsert ? { upsert: true } : undefined);

  if (signError || !signed?.signedUrl) {
    throw signError ?? new Error("Failed to create signed upload URL");
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signed.signedUrl, true);
    if (contentType || file.type) {
      xhr.setRequestHeader("Content-Type", contentType || file.type);
    }
    xhr.upload.onprogress = (event) => {
      if (!onProgress) return;
      const total = event.lengthComputable ? event.total : file.size;
      onProgress({
        loaded: event.loaded,
        total,
        percent: clampPercent(event.loaded, total),
      });
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new DOMException("Upload aborted", "AbortError"));
    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(file);
  });

  return { path: signed.path ?? path };
}

async function uploadViaSdkFallback(
  opts: UploadWithProgressOptions,
): Promise<UploadWithProgressResult> {
  const { bucket, path, file, onProgress, contentType, upsert } = opts;
  onProgress?.({ loaded: 0, total: file.size, percent: 0 });
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: contentType || file.type || undefined,
      upsert: !!upsert,
    });
  if (error) throw error;
  onProgress?.({ loaded: file.size, total: file.size, percent: 100 });
  return { path: data?.path ?? path };
}

/**
 * Upload a file to Supabase Storage with byte-level progress reporting.
 * Prefers signed-URL + XHR; falls back to the SDK upload if signing fails.
 */
export async function uploadFileWithProgress(
  opts: UploadWithProgressOptions,
): Promise<UploadWithProgressResult> {
  try {
    return await uploadViaSignedUrl(opts);
  } catch (err) {
    // Don't fall back on user-initiated aborts.
    if ((err as DOMException)?.name === "AbortError") throw err;
    return await uploadViaSdkFallback(opts);
  }
}
