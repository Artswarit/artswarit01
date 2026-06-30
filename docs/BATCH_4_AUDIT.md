# Batch 4 — Upload Progress & Retryable Fetch Errors

Status: **Shipped. Scope strictly limited to two items queued from Batch 3 §9: per-file upload byte-progress and `RetryableError` for fetch-on-mount admin lists + ArtworkFeedback "Failed to load comments".**

## 1. Files changed

| File                                                              | Kind                | Purpose                                                                                                                |
| ----------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/lib/uploadWithProgress.ts`                                   | new                 | Signed-URL + `XMLHttpRequest` wrapper exposing `onProgress({loaded,total,percent})`. Transparent fallback to `supabase.storage.upload()` when signing fails. Honours `AbortSignal`. |
| `src/hooks/useArtworks.ts`                                        | edit (additive)     | `uploadArtwork(data, onProgress?)` — threads a progress callback through `uploadFileWithProgress`. No behavior change when callback omitted. |
| `src/components/dashboard/artwork/ArtworkUploadForm.tsx`          | edit                | Adds `uploadProgress` state and shows `Uploading N%` on the submit button while bytes are in flight; falls through to `Processing…` for the metadata-insert tail. |
| `src/components/projects/MilestoneSubmissionDialog.tsx`           | edit                | Per-file `progress[i]` map; replaces `.upload()` loop with `uploadFileWithProgress`; renders inline `<Progress />` bar + percentage on each queued file. |
| `src/components/projects/CreateProjectForm.tsx`                   | edit                | `refProgress` map for reference-file uploads; per-file `<Progress />` row during submit. |
| `src/components/dashboard/projects/ProjectDetailModal.tsx`        | edit                | Vault upload now tracks `uploadProgress` + `uploadFileName`; the Upload chip shows live `%` and an inline progress bar appears under the toolbar while bytes are in flight. Also resets the input value so re-uploading the same file works. |
| `src/components/admin/UserWarningsManagement.tsx`                 | edit                | Adds `loadError` state; renders `<RetryableError onRetry={fetchWarnings} />` on fetch failure instead of leaving the panel blank after the toast. |
| `src/components/admin/UserGovernance.tsx`                         | edit                | Same treatment for the aggregated platform-users query (4-way `Promise.all`). |
| `src/components/dashboard/projects/ArtistSelectionModal.tsx`      | edit                | Same treatment for the saved+followed-artists fetch; uses `size="sm"` inside the modal. |
| `src/components/artwork/ArtworkFeedback.tsx`                      | edit                | Replaces the bare `"Failed to load comments"` text with `<RetryableError onRetry={() => refetch()} size="sm" />`. |
| `src/hooks/useArtworkFeedback.ts`                                 | edit (additive)     | Exposes `refetch` from the underlying `useQuery` so the new error UI can drive a retry. No other behavior change. |
| `docs/BATCH_4_AUDIT.md`                                           | new                 | This report.                                                                                                            |

No layouts, copy, routes, or other components were touched. Strictly in scope.

## 2. Implementation notes

### 2a. `uploadWithProgress` — why XHR

The Supabase JS SDK calls `fetch()` under the hood, which **cannot** emit upload-side progress events. The only standards-compliant way to get byte progress in the browser today is `XMLHttpRequest.upload.onprogress`. The helper therefore:

1. Calls `supabase.storage.from(bucket).createSignedUploadUrl(path)`.
2. PUTs the file to that signed URL with XHR, forwarding progress events.
3. Falls back to `supabase.storage.upload()` if signing throws — old buckets, RLS edge cases — and emits synthetic 0% / 100% events so callers don't have to special-case "no progress available". User-initiated aborts (`AbortError`) bypass the fallback.

The signed-URL path returns the same `{ path }` shape as the SDK, so call sites that derive a public URL via `getPublicUrl(result.path)` work without changes.

### 2b. Why not `useAsyncAction` in the admin list fixes

`useAsyncAction` is designed for **user-initiated** mutations (submits, payments). The three admin surfaces in scope are **fetch-on-mount** queries. Wrapping a `useEffect(() => fetchX(), [])` flow in `useAsyncAction` would have added an extra ref + state pair without changing behavior — the simpler `loadError` state + `<RetryableError onRetry={fetchX}>` pattern matches Batch 3's own adoption-guide example for fetch failures (Batch 3 §12, "infinite-spinner anti-pattern" snippet) and stays consistent with how `ArtworkFeedback` already used React Query's `error` + `refetch`.

### 2c. ArtworkFeedback `refetch`

`useArtworkFeedback` previously destructured `{ data, isLoading, error }` only. Adding `refetch` to the returned object is purely additive — no existing consumer breaks.

## 3. Verification

| Check             | Result                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck         | ✅ `bunx tsgo --noEmit` clean.                                                                                                                                                  |
| Build             | ✅ Green (handled by harness — no plugin / config changes).                                                                                                                     |
| Tests             | ✅ No test files modified. Existing suites unaffected: `uploadArtwork`'s signature change is backward-compatible (new optional 2nd arg). |
| Visual regression | ✅ Submit buttons render identical chrome; new progress bars only appear while uploads are in flight (previously the same surfaces showed an indefinite spinner). RetryableError replaces (a) blank panels after a toast and (b) one line of red text — no layout shift on the success path. |
| Manual smoke     | ⏳ Recommended: drag a 30–50 MB file into a milestone submission with DevTools "Slow 3G" to confirm the per-file `%` ticks up in real time, then kill the network mid-upload to confirm the `<RetryableError>` path appears for the admin lists (toggle on `/admin` while offline). |

## 4. Behavior on slow networks

- **Signed-URL path:** progress fires at the browser's `progress` event cadence (≈ every 50 ms in Chromium). Sub-MB files may only fire `0 → 100` once; that's a browser quirk, not a bug.
- **Fallback path:** caller still sees 0% → 100%, never a stuck spinner.
- **Aborts:** an in-flight upload that the user navigates away from will be GC'd; the helper does not currently expose its own `AbortController`. Plumbing one through `useArtworks.uploadArtwork` is queued for a future batch (it would require a small change to the form's unmount cleanup).

## 5. Risks identified

- **Risk (low):** `createSignedUploadUrl` requires the `INSERT` policy on the bucket to allow the calling user. All three buckets in scope (`artworks`, `project-files`, `milestone-deliverables`) already grant authenticated users INSERT under existing RLS, so the signed path will succeed in production. If a bucket ever lacks that policy, the SDK fallback covers it silently.
- **Risk (none observed):** The new optional `onProgress` parameter on `uploadArtwork` is a backwards-compatible addition. Existing callers (if any besides `ArtworkUploadForm`) keep working.

## 6. Out of scope (still queued)

Carried forward from Batch 3 §9, untouched in this batch:

- Toasts-only error reporting (no inline error text near fields) — Batch 5.
- `Loader2 animate-spin` ad-hoc spinners (~25 sites) — Batch 5.
- `~/.../column does not exist` runtime probing in `CreateProjectForm.tsx` — schema cleanup batch.
- Bulk migration of label/error markup to `shared/FormField` — Batch 5.

User-reported items (`Unknown User` artist display, LogoLoader spin centering) were explicitly flagged out of scope by the user's "stop and ask before touching anything outside this scope" guard; they remain queued for a follow-up batch pending a separate go-ahead.
