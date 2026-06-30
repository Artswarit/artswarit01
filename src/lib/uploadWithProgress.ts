/**
 * Upload a single file to Supabase Storage with byte-level progress.
 *
 * Why this exists:
 *   The `supabase-js` storage client (`.upload()`) uses `fetch` internally and
 *   does NOT expose progress events. To surface real upload progress we mint a
 *   signed upload URL via `createSignedUploadUrl()` and PUT the file with
 *   `XMLHttpRequest`, which fires `upload.onprogress`.
 *
 * Falls back transparently to `.upload()` when the signed-URL path is
 * unavailable (older buckets / network shape), so call sites get a
 * best-effort byte progress and still complete on quirky environments.
 *
 * Returns the storage path (same shape as `.upload({ data: { path } })`) so
 * existing call sites can call `getPublicUrl(path)` without changes.
 */
import { supabase } from "@/integrations/supabase/client";

export interface UploadProgress {
  loaded: number;
  total: number;
  /** 0–100, clamped. `total === 0` reports 0 until completion. */
  percent: number;
}

export interface UploadWithProgressOptions {
  bucket: string;
  path: string;
  file: File;
  onProgress?: (progress: UploadProgress) => void;
  /** Aborts the in-flight upload. */
  signal?: AbortSignal;
  /** Forwarded to the underlying upload. */
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
    // Supabase signed PUT does not require auth header (token is in URL).
    xhr.upload.onprogress = (event) => {
      if (!onProgress) return;
      const total = event.lengthComputable ? event.total : file.size;
      onProgress({
        loaded: event.loaded,
        total,
        percent: clampPercent(event.loaded, total),
      });
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.({ loaded: file.size, total: file.size, percent: 100 });
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText || xhr.statusText}`));
      }
    };
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
  // No real progress available — emit a 0% start and 100% on success so
  // consumers can still render a progress UI without special-casing.
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

export async function uploadFileWithProgress(
  opts: UploadWithProgressOptions,
): Promise<UploadWithProgressResult> {
  try {
    return await uploadViaSignedUrl(opts);
  } catch (err) {
    if ((err as DOMException)?.name === "AbortError") throw err;
    // Fall back so a bucket that doesn't support signed upload URLs (or a
    // transient signing error) doesn't block the user. Progress will be
    // 0 → 100 without intermediate updates in that case.
    return await uploadViaSdkFallback(opts);
  }
}
