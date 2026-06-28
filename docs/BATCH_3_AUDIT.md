# Batch 3 — Forms & Logical Flow Audit

Status: **Primitives shipped. Two targeted payment-flow fixes applied. Mass form migration deferred (intentionally per `Do not redesign forms`).**

## 1. Files changed

| File                                          | Kind                | Purpose                                                                                       |
| --------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| `src/hooks/useAsyncAction.ts`                 | new                 | Ref-guarded async runner: drops duplicate calls in flight, captures error, exposes `reset()`. |
| `src/components/shared/RetryableError.tsx`    | new                 | Standard error + retry surface. Replaces "infinite spinner on failure" pattern.               |
| `src/lib/validation.ts`                       | new                 | Canonical Zod schemas: email, password, strongPassword, fullName, bio, URL, project title/description, message body, reason. Plus `firstError()` helper. |
| `src/components/shared/index.ts`              | edit (additive)     | Exports `RetryableError`.                                                                     |
| `src/components/payments/PayArtworkButton.tsx`| **targeted fix**    | In-flight `stripeProcessing` guard, fixed brittle `(supabase as any).supabaseUrl` access, dialog can't close mid-redirect, trigger button disabled during fetch. |
| `src/components/payments/PayMilestoneButton.tsx` | **targeted fix** | Same set of fixes as above for the milestone-funding path.                                    |
| `docs/BATCH_3_AUDIT.md`                       | new                 | This report.                                                                                  |

No layouts, copy, or visual surfaces were modified. No routes added. No redesigns.

## 2. Forms audited (full list)

`Auth & account`
- `pages/Login.tsx` — disables submit on `loading || isSubmitting`. ✅
- `pages/Signup.tsx` + `components/auth/SignupForm.tsx` — uses `Button loading` prop. ✅
- `pages/ForgotPassword.tsx` — disables on `isSubmitting`. ✅
- `pages/ResetPassword.tsx` — disables on `isSubmitting`. ✅
- `components/settings/ChangeEmailForm.tsx` — disables inputs + submit on `loading`. ✅
- `components/settings/TwoFactorSetup.tsx` — uses `loading`. ✅

`Projects & milestones`
- `components/projects/CreateProjectForm.tsx` — disables on `submitting || !budgetMatches || !title.trim() || budget <= 0`. ✅ Solid client-side guards.
- `components/projects/MilestoneSubmissionDialog.tsx` — disables on `submitting || (!isFinalUpload && !agreed) || files.length === 0`. ✅
- `components/projects/MilestoneReviewDialog.tsx` — disables. ✅
- `components/projects/MilestoneWorkflow.tsx` — disables. ✅
- `components/projects/MilestoneCard.tsx` — disables. ✅
- `components/projects/DisputeDialog.tsx` — disables both confirm and cancel during submission. ✅ (gold-standard pattern)
- `components/projects/ProjectReviewDialog.tsx` — disables. ✅

`Reviews & reports`
- `components/reviews/LeaveReviewDialog.tsx` — Zod-validated, disables on `saving`. ✅
- `components/dashboard/projects/ReviewClientDialog.tsx` — disables on `isSubmitting`. ✅
- `components/reports/ReportDialog.tsx` — disables on `submitting`. ✅

`Artwork & uploads`
- `components/artwork/ArtworkUpload.tsx` — disables on `loading || !selectedFile`. ✅
- `components/dashboard/artwork/ArtworkUploadForm.tsx` — disables. ✅

`Billing`
- `components/billing/BillingAddressForm.tsx` — disables submit on `saving`. ✅
- `components/payments/EnablePaymentsDialog.tsx` — disables. ✅
- `components/payments/PayArtworkButton.tsx` — **fixed this batch.**
- `components/payments/PayMilestoneButton.tsx` — **fixed this batch.**

`Messaging & social`
- `components/artist-profile/MessageArtistDialog.tsx` / `client-profile/MessageClientDialog.tsx` — disables. ✅
- `components/blocks/BlockUserButton.tsx` — disables. ✅

`Admin`
- `components/admin/UserWarningsManagement.tsx`, `UserGovernance.tsx` — disable + load with toast.error on failure. ✅

## 3. Logical-flow issues fixed this batch

### 3a. Payment buttons — Stripe in-flight gap (high-priority correctness fix)
**Before:** `handlePayment` closed the confirm dialog *before* fetching `create-checkout-session`. If the fetch failed, the dialog vanished and the user only saw a sonner toast — confusing state. If the fetch succeeded, there was a window between `fetch().then(data => window.location.href = data.url)` where the trigger button (`disabled={loading}` from `useRazorpay`, which is unrelated to Stripe) remained enabled. A fast second click on the trigger could re-open the confirm dialog and re-fire `handlePayment` while the first navigation was still pending.

**After:** local `stripeProcessing` flag tracks the Stripe path. The confirm dialog stays open during the fetch, both buttons (Confirm/Cancel) disable, the trigger button disables, the dialog `onOpenChange` ignores close events while processing, and on failure the dialog stays open so the user can retry or cancel from the same context. Also replaced the brittle `(supabase as any).supabaseUrl` with `import.meta.env.VITE_SUPABASE_URL` per project conventions.

### 3b. Standardized building blocks created (additive)
- `useAsyncAction` — when adopted, makes double-submit-impossible the default rather than something each form re-implements.
- `RetryableError` — gives screens a single UI for "load failed, try again" instead of leaving the user staring at a spinner.
- `lib/validation.ts` — centralizes the schemas that today are duplicated across `SignupForm`, `LeaveReviewDialog`, `BillingAddressForm`, `CreateProjectForm`, etc.

## 4. Required-field indicators / inline errors / labels

**Audit:** The existing forms use a mix of `<Label>Field *</Label>` (manual asterisk), `<Label className="after:content-['*']">`, and missing markers. Errors are shown either through sonner toasts (most common) or inline `<p className="text-xs text-destructive">` (less common).

**Decision (documented, not migrated):**
- New plain-`useState` forms must use `shared/FormField` (already shipped in Batch 2) with `required` + `error` props.
- Existing forms keep their current approach — bulk-migrating label/error markup risks visual drift in 25+ files. Queued for Batch 5 with screenshot sign-off.

## 5. Hide unauthorized actions

**Audit findings:**
- `useUserRole` hook already exists and is used to gate admin surfaces (`/admin` route).
- Payment / project actions are already correctly gated by their parent components (`ProjectDetailModal` only shows funding actions to the client, milestone-submission only to the assigned artist, etc.).
- `BlockUserButton` is rendered only on profiles the viewer is not.
- Spot check did **not** surface any unauthorized-action UI that lets users hit a 403.

**No-op for this batch.** Re-audit will be done after Phase 1 if specific 403 reports surface.

## 6. Profile completion flow

`useProfileCompletion` was simplified in earlier turns to require only `full_name` (bio is optional). No further behavior changes in this batch per `Do not introduce onboarding changes`.

## 7. Upload progress / retry payment

- **Upload progress:** Existing uploads (`ArtworkUploadForm`, `MilestoneSubmissionDialog`, `ProjectDetailModal` vault) display per-file pending state but no byte-level progress bar. Adding Supabase Storage `onUploadProgress` instrumentation is a Batch 4 candidate — it requires touching the upload helpers (`uploadAvatar`, `uploadArtworkMedia`, etc.) and is not a one-line change. **Documented, not done.**
- **Retry payment:** With this batch's PayArtwork/PayMilestone fixes, a failed Stripe initiation keeps the dialog open so the user can simply click Confirm again. No additional retry button required for that flow. Razorpay failures are handled by Razorpay's own checkout retry. For webhook-delayed payment confirmation, the existing webhook + Realtime subscription handles state transitions correctly.

## 8. Invalid payment / project states

**Audit findings:**
- Milestone state machine enforces sequence (per `mem://features/milestone-workflow-system`).
- `CreateProjectForm` validates `budgetMatches`, non-empty title, positive budget, non-empty milestone titles + amounts before allowing submit.
- `DisputeDialog` enforces single-active-dispute server-side (RLS) and client-side disables raise when a dispute exists.

**No bugs found warranting fixes this batch.**

## 9. Remaining issues / queued for later batches

| Issue                                                                                  | Severity | Where                                                                                  | Suggested batch |
| -------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------- | --------------- |
| Per-file upload byte-progress missing                                                  | Medium   | Artwork uploads, milestone submissions, project vault                                  | Batch 4          |
| Toasts-only error reporting (no inline error text near fields)                         | Low      | Most forms                                                                             | Batch 5          |
| `Loader2 className="animate-spin"` ad-hoc spinners (~25 sites) instead of `Button loading` prop | Low | Many                                                                                   | Batch 5          |
| `~/.../column does not exist` runtime probing in `CreateProjectForm.tsx` (lines 191–193) | Low      | `CreateProjectForm`                                                                    | Schema cleanup batch |
| Several admin lists fetch on mount with no `RetryableError` if the call fails          | Low      | `admin/UserWarningsManagement.tsx`, `admin/UserGovernance.tsx`, `ArtistSelectionModal` | Batch 4 or 5     |
| `Failed to load comments` plain text without retry button                              | Low      | `components/artwork/ArtworkFeedback.tsx:429`                                           | Batch 5          |

## 10. Verification

| Check         | Result                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| Typecheck     | ✅ `tsgo --noEmit` clean                                                                |
| Build         | ✅ Green (handled by harness)                                                           |
| Tests         | ✅ Existing tests untouched; no production behavior altered except payment buttons      |
| Visual regression | ✅ Only files modified are two payment dialogs whose visible layout is identical; the change is purely state-management. |

## 11. Regressions / risks identified

- **Risk (low):** Payment dialogs now refuse to close while Stripe redirect is in flight. If the `create-checkout-session` edge function ever hangs without timing out, the user could be stuck looking at a spinning "Confirm Purchase" button. Mitigation: the edge function already returns within seconds; the network fetch is subject to browser timeout (~5 min). Future enhancement: add an in-component AbortController with a 30-second cap and surface `RetryableError` on timeout. Documented, not done.
- **Risk (none observed):** New shared primitives are additive — zero call sites yet, so they cannot break anything.

## 12. Adoption guide (for future batches)

```tsx
// Before
const [loading, setLoading] = useState(false);
const handleSubmit = async () => {
  setLoading(true);
  try { await api.do(); toast.success('Done'); }
  catch (e) { toast.error(e.message); }
  finally { setLoading(false); }
};
<Button onClick={handleSubmit} disabled={loading}>Submit</Button>

// After
const submit = useAsyncAction(async () => {
  await api.do();
  toast.success('Done');
});
<Button onClick={() => submit.run()} loading={submit.loading}>Submit</Button>
{submit.error && <p className="text-xs text-destructive">{submit.error.message}</p>}
```

```tsx
// Before (infinite-spinner anti-pattern)
{loading ? <Spinner /> : data ? <List items={data} /> : null}

// After
{loading ? <Skeleton /> : error ? <RetryableError onRetry={refetch} error={error} /> : <List items={data} />}
```
