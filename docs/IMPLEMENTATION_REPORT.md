# Artswarit — Implementation Report

**Date:** 2026-08-10
**Scope:** All nine implementation phases complete — §2a security · §2b business logic & data integrity · §2c user flows & navigation · §2d forms/actions/interactions · §2e UI consistency & dark mode · §2f responsive/mobile · §2g accessibility · §2h performance · §2i final QA. What remains is itemised in "Remaining known issues" with evidence for each.

**Verification for every change below:** `tsc --noEmit` clean, `vite build` green, `vitest run` 12/12 passing, ESLint introduces no new errors.

> Note on scope discipline: this pass deliberately did **not** attempt all 22 requested areas at once. The critical items touch live payment, escrow, and admin logic, and several required tracing dependencies before it was safe to change anything. Breadth was traded for correctness on the items that can lose money or leak access.

---

## 1. Security fixes

### 1.1 Payment verification IDOR — free artwork (Critical)
`supabase/functions/verify-artwork-payment/index.ts`

The HMAC only proves Razorpay signed an `order_id|payment_id` pair; it says nothing about *which artwork* was bought. The endpoint took `artworkId` from the request body, so a user could pay for a cheap artwork and then call it with any other artwork's id — repeatable indefinitely with one payment.

**Root cause:** no server-side binding between the paid order and the unlocked resource.
**Fix:** the order is re-fetched from Razorpay's API and the artwork is read from the server-written `notes.artwork_id`. Also asserts the order is `paid`, is an `artwork_unlock` order, and belongs to the caller; rejects a mismatched client hint; and pre-checks for an existing unlock so retries are idempotent instead of surfacing a constraint error.

### 1.2 Payment verification IDOR — arbitrary milestone activation (Critical)
`supabase/functions/verify-razorpay-payment/index.ts`

`milestoneId` came from the request body and was applied without checking it matched the payment record, letting any user flip **any** milestone on the platform to `ACTIVE` using one legitimate payment.

**Fix:** the milestone is taken from `payment.milestone_id` (the row already looked up by `razorpay_order_id`). Mismatched hints are rejected and logged. The status write is scoped to `WAITING_FUNDS` so a duplicate/late verification racing the webhook cannot regress a milestone that has moved on.

### 1.3 Database policy hardening (Critical)
`supabase/migrations/20260810120000_security_rls_hardening.sql` *(new)*

| Hole | Fix |
|---|---|
| RLS never enabled on `user_roles` (policies inert) | Enabled — verified safe because artist/client role reads come from `profiles.role`, and `is_admin()` is `SECURITY DEFINER` so it doesn't recurse |
| RLS never enabled on `razorpay_orders`, `razorpay_payments`, `tasks` | Enabled with no policies — confirmed zero references in both `src/` and `supabase/functions/`, so deny-by-default is correct; service role still bypasses |
| RLS never enabled on `sales`, `artwork_likes` | Enabled **with** explicit policies matching actual usage (buyer/artist read for `sales`; public read + own-row write for `artwork_likes`) |
| `users` UPDATE had no `WITH CHECK` → self-promotion to admin | `WITH CHECK` pins `role` to its existing value |
| `transactions` INSERT let a buyer forge `status='success'` | Client INSERT policy dropped (verified: no client code inserts; the edge function uses service role) |
| `artwork_unlocks` INSERT was `WITH CHECK (true)` → free artwork | Client INSERT policy dropped (verified read-only from the client) |
| `disputes` had no participant UPDATE policy | Added a scoped policy so withdrawal actually persists (see §2.3) |
| RLS predicate columns unindexed | Added 10 indexes on the FK/RLS columns that were forcing sequential scans |

**Escrow state machine enforcement.** RLS `WITH CHECK` can only see the NEW row, so a `BEFORE UPDATE` trigger (`enforce_milestone_transition`) was required to compare OLD→NEW. It rejects illegal transitions and freezes money columns (`amount`, `amount_paid`, `amount_usd`, `paid_at`, `payment_id`, `approved_at`) for end users, while exempting service-role callers and admins.

The allowed transition list was derived by auditing **every** client-side milestone write in the codebase, so no shipped flow breaks. Two findings from that audit:
- `MilestoneSubmissionDialog`'s `COMPLETED` write is a **no-op re-write** (it only runs when the milestone is *already* completed) — not a bypass, and still permitted.
- `ProjectDetailModal`'s status toggle **was** a real bypass — see §2.1.

### 1.4 Unauthenticated AI endpoints (Critical)
`artist-gpt-chat`, `universal-chatgpt-assistant`, `_shared/rateLimit.ts` *(new)*, `supabase/migrations/20260810130000_api_rate_limiting.sql` *(new)*

Both proxy paid LLM APIs with `verify_jwt = false` and no in-code auth or throttle.

The two needed **different** treatment, established by tracing callers:
- **`universal-chatgpt-assistant`** powers the site-wide chatbot, which renders on public pages for logged-out visitors. Requiring auth would break anonymous users, so it keeps public access and gained **rate limiting** (20 req/min per user id, or per client IP when anonymous).
- **`artist-gpt-chat`** has **no caller anywhere in the frontend**. It now requires a valid session *and* is rate limited — no UX cost.

Added a shared fixed-window limiter backed by a new `api_rate_limits` table and an atomic `check_rate_limit()` function. It **fails open** — a limiter outage degrades to no throttling rather than taking the feature down.

---

## 2. Business logic & money-correctness fixes

### 2.1 Milestone marked paid without any payout (Critical)
`src/components/dashboard/projects/ProjectDetailModal.tsx`

The client-facing "toggle status" action wrote `status='COMPLETED'` and `approved_at` **directly to the table**, bypassing `release-milestone-payout` entirely. The milestone showed as completed/paid while no money reached the artist. It could also toggle a genuinely-paid milestone back to `ACTIVE`.

**Fix:** the action now calls `release-milestone-payout`, the same path the review dialog uses (validates the caller is the project's client, requires `REVIEW_PENDING`, takes an atomic lock, pays out, then marks complete). The "un-complete" direction is removed — a released payout is not reversible — with an explicit message instead of a silent failure.

### 2.2 "Start Milestone" threw on every click (High)
`src/components/projects/MilestoneWorkflow.tsx`

Wrote the legacy value `'in_progress'`, which is not part of the `milestone_status_v2` enum, so Postgres rejected every attempt behind a generic toast.

**Fix:** writes `'ACTIVE'`, scoped via `.in('status', ['ACTIVE','REVISION_REQUESTED'])`. Verified against the UI that the button is only reachable from those two states, so this cannot move an unfunded milestone into a funded one. The error toast now surfaces the real message instead of swallowing it.

### 2.3 Dispute resolution could double-pay; withdrawal silently failed (Critical)
`supabase/functions/resolve-dispute/index.ts` + migration

- **No idempotency:** nothing checked or locked `dispute.status` before issuing refunds/payouts, so a retry or double-submit moved money twice. Now takes an atomic conditional lock (`status → 'resolving'`), returns 409 on a concurrent attempt, and short-circuits an already-resolved dispute.
- **No payout cap:** `artistPayout + clientRefund` was never validated against the escrowed amount server-side — the only guard was a disabled button in the admin UI. Now capped at `payment.amount` (with a cent of rounding tolerance) and negative amounts are rejected.
- **Lock release:** the catch block restores the previous status so a failed settlement can be retried instead of stranding the dispute in `resolving`.
- **Withdrawal:** `disputes` had no participant UPDATE policy, so the in-app withdraw affected 0 rows (no error raised) while the paired milestone revert succeeded — the dispute stayed open forever while the UI showed it resolved. A scoped policy now lets the raiser withdraw their own open dispute.

### 2.4 Stripe premium subscribers paid and got nothing (Critical)
`supabase/functions/stripe-webhook-handler/index.ts`

The activation insert wrote a **`plan` column that does not exist** on `subscribers` and omitted the `NOT NULL` `email`, so it failed every time — logged, never surfaced — while the buyer saw "Premium Activated". Separately, the lifecycle handler `SELECT`ed the same non-existent column (so no lifecycle event ever resolved a user), and cancellation never revoked access.

**Fix:** upsert (not insert, for webhook retry safety) with the correct columns — `subscription_tier` mapped from the checkout plan (`pro`→monthly), `email`, and an explicit `renew_at`, since the app treats `renew_at IS NULL` as never-expiring. The lifecycle handler now selects real columns, **extends** `renew_at` on `invoice.paid`, and **revokes** `is_active` on cancellation/expiry — matching the behaviour the Razorpay rail already had.

---

## 2b. Phase 2 — business logic & data integrity

### 2b.1 Stripe-funded milestones never activated (Critical — newly found)
`supabase/functions/stripe-webhook-handler/index.ts`

The webhook set `status: 'PAID'` on the milestone, but `PAID` is **not** a member of `milestone_status_v2`. The write therefore failed every time — and because the result was never checked, it failed silently. A client who funded a milestone through Stripe was charged and the milestone stayed in `WAITING_FUNDS`.

**Fix:** writes `ACTIVE` (the funded state the Razorpay path uses) plus `paid_at`, scoped to `WAITING_FUNDS` so a retry can't regress a milestone. Same class of bug as the `in_progress` one in §2.2 — a legacy status value surviving the enum migration.

### 2b.2 Stripe artwork checkout could massively overcharge (High)
`supabase/functions/create-checkout-session/index.ts`

`artwork.price` was charged as raw USD cents while ignoring `metadata.currency`, which `create-artwork-order` reads on the Razorpay side. A ₹5,000 artwork billed a Stripe buyer **$5,000** instead of ~$60.

**Fix:** converts using the same stored-currency logic and exchange rate the Razorpay path already uses, validates the computed price, and records the converted amount on the transaction row (`amount`/`amount_usd` were also storing the unconverted number).

Two further gaps closed in the same function:
- **No availability check** — a buyer could open a checkout for artwork they already owned. Now mirrors `create-artwork-order`'s unlock pre-check.
- **No client authorization on the milestone branch** — any authenticated user could start a Stripe checkout against someone else's milestone. Now verifies the caller is the project's client, matching `create-milestone-order`.

### 2b.3 Unchecked webhook writes (High)
`supabase/functions/stripe-webhook-handler/index.ts`

All four DB writes in the artwork path (and the milestone path) were fire-and-forget, so a failure left the buyer charged with no unlock and no signal.

**Fix:** every write is checked; failures that matter (the unlock insert, milestone activation) throw so Stripe retries, while cosmetic ones (notifications) log and continue. Write order was changed so the **unlock is recorded before the artwork is archived** — previously a failure between the two left the artwork unavailable *and* unowned. Added an idempotency guard keyed on the existing unlock so retries don't re-notify or re-archive.

### 2b.4 Razorpay artwork purchases had no webhook safety net (High)
`supabase/functions/razorpay-webhook/index.ts`

The webhook resolves a `payments` row by `razorpay_order_id`, but artwork purchases never create one (`create-artwork-order` only creates a Razorpay order). Every artwork payment therefore hit "payment record not found" and was discarded — so a buyer whose tab closed after paying lost the unlock permanently, with no recovery path. Milestone funding had a webhook fallback; artwork did not.

**Fix:** when no payment record matches, the order is fetched from Razorpay and, if its notes mark it an `artwork_unlock`, the unlock is completed server-side (idempotent, notifies the artist). Artwork purchases now have the same safety net as milestone funding.

### 2b.5 Blocking a user did nothing (High)
`supabase/migrations/20260810140000_enforce_user_blocks.sql` *(new)*, `src/hooks/useRealtimeMessages.ts`

`BlockUserButton` promises "they won't be able to message you", but `user_blocks` was only ever **written** — nothing read it. Both parties could keep messaging after a block.

**Fix:** a `BEFORE INSERT` trigger on `messages` rejects sends when a block exists in **either** direction (the blocker shouldn't receive messages, and the blocked user shouldn't reach them). Implemented as a trigger rather than RLS so it applies to every writer and doesn't have to be merged with the partly-untracked policies on `messages`. The client surfaces a specific message instead of a generic failure. Added supporting indexes.

### 2b.6 No server-side upload limits (Medium)
`supabase/migrations/20260810150000_storage_upload_limits.sql` *(new)*

No bucket declared `allowed_mime_types` or `file_size_limit`; the only gating was client-side `accept=` attributes, bypassable by calling the Storage API directly.

**Fix:** image buckets get a strict image allowlist (SVG deliberately excluded — it can carry script and these buckets are public) and a 15 MB cap. Deliverable buckets get a 50 MB cap matching the existing client-side limit, but **no MIME allowlist** — artists legitimately deliver PSD/AI/FIG/ZIP/video, and guessing that list would break real deliveries. Flagged as a follow-up needing a product decision.

### 2b.7 Missing workflow notifications (Medium)
`MilestoneSubmissionDialog.tsx`, `MilestoneReviewDialog.tsx`, `DisputeDialog.tsx`

Three events that change what the other party must do produced no notification — including one where the toast explicitly claimed "the artist will be notified".

**Fix:** added notifications for milestone submitted (→ client), revision requested (→ artist), and dispute raised (→ counterparty, since a dispute freezes the milestone and they were never told why work stopped). All best-effort: a notification failure logs but does not fail the action that already succeeded. The submission-status write is now error-checked too.

> Correction to the audit: it reported that `MilestoneReviewDialog`'s revision status-update had no error check. It does (`if (updateError) throw updateError`). Only the notification was missing.

---

## 2c. Phase 3 — user flows & navigation

### 2c.1 No feedback after paying with Stripe (High)
`src/components/analytics/StripeReturnTracker.tsx`

Returning from Stripe Checkout, the app read `?status` / `?milestone` / `?premium` **only** to fire analytics, then stripped the params from the URL. The user was dropped back on the page with no acknowledgement that anything had happened — indistinguishable from a failed payment.

**Fix:** a toast on every return path (artwork / milestone / subscription, success and cancel). Success copy is deliberately worded as *confirming* rather than *complete*, because the webhook that actually grants access can land a moment later — promising completion here would be a lie when the webhook is slow.

> Correction to the audit: it stated these params were "never read". They were read for analytics; what was missing was any **user-facing** feedback.

### 2c.2 Expired verification links dead-ended on the homepage (High)
`src/components/auth/AuthLinkErrorHandler.tsx` *(new)*, wired into `App.tsx`

Supabase reports a failed verification link by appending `#error=access_denied&error_code=otp_expired…` to the redirect target, which for signup is `/`. Nothing inspected that hash, so a user clicking an expired or already-used link landed on the homepage with no explanation and no route forward. `ResetPassword` handled this pattern for recovery links; nothing else did.

**Fix:** a global handler decodes the error, explains it in plain language, clears the hash so a refresh doesn't re-fire, and routes the user to the resend page. Recovery links are explicitly skipped so `ResetPassword` keeps owning that flow.

### 2c.3 No way to get a new verification email once logged out (High)
`src/pages/EmailVerification.tsx`, `src/pages/Signup.tsx`

`/verify-email` is a public route, but its resend required an active session — logged out, it just said "Please log in to verify your email". An unconfirmed account can't get past login, so this was a genuine dead end: no path to a working link short of contacting support.

**Fix:** the logged-out view is now a self-service resend form (`supabase.auth.resend` works unauthenticated), prefilled from `?email=`. The signup confirmation screen links straight to it. The response deliberately does **not** confirm whether the address exists — otherwise it becomes an oracle for probing registered emails.

### 2c.4 Unclear primary actions (Medium)
`DashboardAttentionRequired.tsx`, `ClientDashboard.tsx`

- Every attention card computed an `actionLabel` ("View Messages", "Finish Setup", "Manage Project") and then **discarded it**, rendering an icon-only chevron. A high-severity unread-messages card looked identical to a low-severity setup nudge, and the control had no accessible name. Now renders the label as a visible link-style action, with `aria-label` on the icon button.
- On a **Draft** project, "Assign Artist" is the only way forward but rendered at the same weight as View/Delete. It's now the filled primary action, while staying secondary ("Reassign") on Pending Confirm where "Confirm" is correctly primary.

> Considered and rejected: the audit flagged two "duplicate" New Project buttons on `ClientDashboard`. One is a toolbar action, the other an empty-state CTA that only appears when there are no projects — a standard and useful pattern, not a defect. Left alone.

**Verified in a browser** (dev server, not just typecheck): the new resend page renders with correct prefill, input type and label association; the restructured signup JSX still renders its full form. Console is clean apart from pre-existing dev-mode service-worker MIME warnings.

---

## 2d. Phase 4 — forms, actions & interactions

### 2d.1 Comments sheet was a keyboard trap (High)
`src/components/artwork/ArtworkFeedback.tsx`

The artwork comments bottom-sheet is hand-rolled rather than built on Radix, so it inherited none of Radix's dialog behaviour. It had no `role="dialog"`, no `aria-modal`, no accessible name, no Escape handler, and its close button was an unlabelled icon. A keyboard-only user who opened it **could not close it** — the only exits were clicking the overlay or an X with no accessible name.

**Fix:** added Escape-to-dismiss, `role="dialog"` + `aria-modal` + `aria-labelledby` wired to the existing heading, a label on the close button, and `aria-hidden` on the decorative overlay and drag handle so they don't surface as phantom controls. Kept the existing markup rather than swapping in Radix `Sheet`, because the bottom-sheet styling is deliberately tuned and a swap risks visual drift for no accessibility gain.

### 2d.2 Milestone form fields had no label association (Medium)
`src/components/projects/CreateProjectForm.tsx`

All five milestone fields (title, amount, description, deliverables, due date) had `<Label>` with no `htmlFor` and inputs with no `id`. Clicking a label did nothing, and screen readers announced the fields with no indication of purpose. Because the fields render inside a `.map()`, the fix needed per-row unique ids (`milestone-title-0`, `milestone-title-1`, …) rather than static ones. The currency symbol overlay is now `aria-hidden` so it isn't read as part of the value.

### 2d.3 Icon-only buttons with no accessible name (Medium)
12 buttons across 10 files

**The audit's figure of 27 was wrong**, and so was my first attempt to verify it. A line-based grep counts the `size="icon"` line and misses an `aria-label` on a different line; a naive `<Button[^>]*>` regex is also wrong because `onClick={() => …}` contains a `>` that truncates the tag early. Both approaches produce false positives.

Scanning with a brace-aware parser gave the real number: **13**, of which one (`ui/sidebar.tsx`) already had `sr-only` text and is a vendored shadcn primitive, so it was correctly left alone. Labelled the other 12: chat back button and message-search toggle, Explore grid/list toggles (with `aria-pressed`) and filter-removal chips, media-player shuffle/repeat/skip controls, and the delete/edit/add actions on collections, services, milestones, reviews, tags, attachments and recovery codes.

Several files the audit named — `SocialShareButtons`, `ReviewCard`'s delete, `ArtworkManagementCard` — **already had** correct labels (share buttons carry theirs on the inner anchor via `asChild`). They were verified, not changed.

---

## 2e. Phase 5 — UI consistency & design system (dark mode)

Measured in a real browser with dark mode active, not inferred from grep. A static scan flagged 125 "suspect" lines, but most were intentional (video-overlay chrome, the always-dark footer, white CTAs on coloured heroes). Running the app and computing background luminance separated genuine breakage from design intent.

### 2e.1 `/trending` ignored dark mode entirely (High)
`src/pages/Trending.tsx`, `src/components/discovery/TrendingAlgorithm.tsx`

Measured **27 light-coloured regions** in dark mode, including a full-page `min-h-screen bg-[#fafafa]` wrapper 5,326px tall. The 503-line `TrendingAlgorithm` component contained no `dark:` classes at all.

**Fix:** converted to semantic tokens (`bg-card`, `bg-background`, `text-muted-foreground`, `border-border`) rather than bolting on `dark:` variants. This is safe *because* `--card` is `0 0% 100%` (pure white) and `--background` is ~`#fafafa` in light mode — so light rendering is byte-for-byte unchanged while dark finally works. Re-measured: **0 light regions**.

Also fixed the active category pill, which used `bg-slate-900` — a near-black chip that reads strongly in light mode but computed `rgb(15,23,42)` against an `rgb(18,23,33)` background, i.e. invisible. Now `bg-primary`.

### 2e.2 `.glass-card` broke dark mode for every consumer (High — root cause)
`src/index.css`

The homepage still showed 14 light regions in dark mode on elements that *already* used the correct `bg-card` token. The cause was three shared component classes — `.glass-card`, `.glass-effect`, `.mobile-card` — each hardcoding `bg-white/40`–`/60`, overriding whatever token the consuming element set.

This is why per-file dark-mode fixes kept missing: the bug wasn't in the components, it was in the shared class they all use. Fixing the three definitions removed 6 light regions across the homepage in one change and applies to every `glass-*` consumer app-wide.

The white *border* was deliberately kept — it's the edge highlight that makes the glass read, and it works over both light and dark backgrounds.

### 2e.3 Remaining surfaces
`EarningsAnalysis` (8), `CreateProjectForm` (11), `ArtistSettings` (1, the sibling of the already-fixed `ClientSettings`), `ProfileCompletionWizard` (3, spots its own "fully support dark mode" commit missed), `Index` stat/testimonial cards (4), plus three headings (`LiveStreaming`, `ArtistProfile`, `ArtworkCardModern`) that used `text-gray-900` and would have rendered near-invisible dark-on-dark.

### Verification
| Surface | Before | After |
|---|---|---|
| `/trending`, dark | 27 light regions | **0** |
| `/` (home), dark | 14 light regions | **3** — all intentional white CTAs, violet text, ~5.9:1 contrast |
| Text contrast, `/trending` | — | 1 flagged, a false positive (`rgba(0,0,0,0)` gradient-clipped heading) |
| **Light mode regression** | — | **none** — `.glass-card` still computes `rgba(255,255,255,0.4)`, stat cards `rgba(255,255,255,0.6)`, exactly as before |

> Measurement note: the first `getComputedStyle` call after a navigation or reload returns stale values, which produced two false readings during this work (a "28 light islands" result that was really 0, and an apparent light-mode regression that wasn't). Every figure above is from a confirmed second measurement.

---

## 2f. Phase 6 — responsive / mobile

**No code changes. Nothing substantive was found to fix.**

Measured in a real browser rather than inferred, using the project's own criteria from `tests/e2e/dashboard-layout.spec.ts` (no horizontal overflow on `/`, `/login`, `/explore`, `/categories`, plus `/trending` and `/signup`).

| Viewport | Routes checked | Horizontal overflow |
|---|---|---|
| 375×812 (mobile) | 6 | **0px on every route** |
| 768×1024 (tablet) | 4 | **0px on every route** |

Touch targets under 32px were almost entirely **inline text links inside sentences** ("Forgot password?", "Terms of Service", footer links) — WCAG 2.5.8 explicitly exempts inline targets, so these are not defects. The apparent "18×18 button" on `/signup` turned out to be the *icon* inside a password-visibility toggle whose actual hit area is ~34×48 (`absolute inset-y-0` over an `h-12` input) — a measurement artefact, not a bug.

The audit's assessment that responsiveness was "in noticeably better shape than dark-mode/a11y" is confirmed.

### One finding, deliberately not fixed
`src/components/ui/checkbox.tsx:17` hard-locks every checkbox in the app to 18×18 through inline `width/height/minWidth/minHeight/maxWidth/maxHeight`. That is below the WCAG 2.5.8 (AA) 24×24 minimum, and the inline `max*` values mean **no consumer can override it**.

It is largely mitigated where a `<Label htmlFor>` is present and clickable (as on `/signup`, where tapping the terms sentence toggles it), so the functional target is much larger than the visual one.

Not changed because the obvious fixes are both bad trades:
- Enlarging it alters visual density on every checkbox app-wide — a design decision, not a bug fix.
- The usual "expand hit area with an offset `::before`" trick doesn't work here: the Root also sets `overflow-hidden` (needed to clip the indicator to the rounded shape), which would clip the pseudo-element.

Fixing it properly means a deliberate change to a shared primitive plus visual sign-off. Flagged for that rather than done unilaterally.

---

## 2g. Phase 7 — accessibility (focus visibility)

Most of Phase 7 was absorbed into Phases 4–6 (labels, dialog semantics, target sizes, contrast). The one area not yet checked was keyboard focus visibility.

`src/components/ui/button.tsx` already applies `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` to every `Button`, so the shared primitive is correct. Of 36 places that set `outline-none` outside it, 14 supply their own `focus:ring`/`focus:border`. Two removed the only focus indicator with nothing in its place:

- **`ReviewClientDialog.tsx:129`** — the 1–5 star rating buttons used `focus:outline-none` with no replacement, so a keyboard user tabbing the stars could not see which one was focused. The rating control was effectively unusable without a mouse. Added `focus-visible:ring-*`, plus per-star `aria-label` and `aria-pressed` (the stars were also unlabelled).
- **`ArtworkFeedback.tsx:502`** — the comment composer's `<input>` sets `outline-none` and its wrapper had no `focus-within` styling, so focusing the field showed nothing at all. Added `focus-within:ring-*` to the wrapper.

## 2h. Phase 8 — performance

### 2h.1 N+1 on the client profile (High)
`src/pages/UserProfile.tsx:208`

Reviews were enriched in a sequential `for` loop that awaited **two queries per review** — up to 20 round trips before the page could render, which the audit estimated at 1.5–3s of added load time.

**Fix:** collect the distinct artist and project ids, then issue two parallel `.in()` lookups and resolve from `Map`s. **20 sequential round trips → 2 parallel ones**, independent of review count.

### 2h.2 Analytics fetched entire tables to count rows (High)
`src/hooks/useRealAnalytics.ts:69`

Nine of the twelve dashboard queries used `select('id')` and then read `.length`, transferring every matching row just to count it. For an established artist that is thousands of UUIDs per dashboard load, on every mount, uncached.

**Fix:** converted those nine to `select('id', { count: 'exact', head: true })` — a HEAD request returning only a count header — and updated the readers to use `.count`. The three revenue queries still select `amount`, because they genuinely need the values to sum; that distinction is deliberate, not an oversight.

### Not attempted
The largest remaining performance item is architectural: React Query is used in roughly 4 of ~37 data-fetching sites, so its cache protects almost nothing (`src/App.tsx` configures sensible 5-min `staleTime`). Migrating the rest is a broad refactor across ~33 files with real regression risk, and belongs in its own reviewed pass rather than bolted onto this one. Same for broadening `getOptimizedImageUrl` (currently 5 of the many artwork-rendering components) and lazy-loading `emoji-picker-react`.

---

## 2i. Phase 9 — final QA sweep

Re-ran the checks from the brief's §21 against the post-implementation codebase.

| Check | Result |
|---|---|
| `TODO` / `FIXME` / `HACK` / `XXX` | **None** anywhere in `src/` or `supabase/functions/` — confirmed, not assumed |
| Broken imports / unresolved modules | **None** — production build resolves clean |
| `console.log` in production paths | **None** — the single grep hit is a comment reading "No production logging — removed console.log" |
| Typecheck | Clean |
| Unit tests | 12/12 passing |
| Build | Green |

### Fixed: dead file with a conflicting cache config
Deleted `src/queryClient.tsx`. It had **zero importers** and exported a *second* `QueryClientProvider` carrying its own `QueryClient` (`staleTime: 60s`) that competed with the real one in `App.tsx` (`staleTime: 5min`, `gcTime: 30min`). Beyond being dead weight, it was a trap: importing it by mistake would have silently created a second cache, splitting query state with no visible error.

### Found and flagged, not changed

**Hardcoded demo artists ship to production.** `src/pages/ArtistProfile.tsx:32-91` embeds two fabricated profiles ("Alex Rivera", 12,035 followers, Unsplash photography) behind fixed UUIDs, with `/artist/1` and `/artist/2` mapped to them, plus synthetic likes/views injected into their portfolios (`likes: a.likes || (isDemoProfile ? 100 + ix * 11 : 0)`).

Scoped to those two ids only, so it cannot leak into a real artist's profile — real artists have real UUIDs. Left in place because it may be a deliberate demo/walkthrough path, and deleting it would break that. **But it presents invented follower counts as real on a live marketplace**, so it warrants a product decision rather than being left unexamined.

**Six modules with zero consumers.** `useAsyncAction`, `lib/validation.ts`, and the four `shared/` primitives (`EmptyState`, `PageHeader`, `FormField`, `ConfirmDialog`) still have no call sites — unchanged since Batch 2/3 created them. (`shared/RetryableError` is the exception; it *is* used.) Also `ProfileForm` and `TagManager` have **0 render sites** anywhere. Not deleted: these were deliberate prior work intended for a migration that hasn't happened. The decision to make is migrate-or-delete — leaving them is the worst option, because two competing patterns now coexist as the de facto standard.

---

## 2j. Live interactive testing pass (2026-08-11)

Requested: fix UI/UX gaps, friction, missing states, and verify by actually triggering flows rather than just loading pages. Done against a real authenticated session (an existing client account, active in the dev browser) plus every public route, since no test credentials were available to log in fresh.

**Scope honestly stated:** this was one focused pass, not exhaustive coverage of every button/tab/modal in the app. It found and fixed real bugs by actually clicking, typing, and submitting — not by reading code and guessing. Deeper flows (milestone submission, dispute UI, artist-side dashboard, payment dialogs) were not clicked through this pass; they're candidates for a follow-up in the same style.

**Bugs found by testing, fixed, and re-verified live:**

1. **Confusing dead-end warning on completed projects.** A finished project's detail modal showed *"Milestone total doesn't match project budget. Please adjust milestones before proceeding"* — on a project where milestones are locked and there is nothing to adjust. Now suppressed once `status` is `completed`/`cancelled`. (`MilestoneWorkflow.tsx`)
2. **Negative day count on overdue deadlines.** An overdue project showed *"-222 Days Remaining"* instead of something legible. Now reads *"222 Days Overdue"* / *"Due Today"* / *"N Days Remaining"* as appropriate. (`ProjectDetailModal.tsx`)
3. **Empty inbox with no way forward.** The client-side empty state said "Start a conversation with an artist" with no actual link to do so. Added an "Explore Artists" CTA, shown only when the inbox is genuinely empty (not when a conversation list exists but nothing is selected, which would have made it redundant clutter). (`MessagingModule.tsx`)
4. **React warning on every artist-profile render.** `fetchPriority` (camelCase) isn't recognized by React 18 — that JSX prop needs React 19. Fixed to the lowercase DOM attribute `fetchpriority`, exactly as React's own warning message specified. (`ArtistHeader.tsx`)
5. **Inconsistent, incomplete abort-error suppression across six call sites.** `useRealtimeMessages.ts` had six near-duplicate inline checks for "was this fetch aborted by navigation, not a real failure" — each catching a different subset of the shapes Supabase actually produces (`error.name`, `error.code` as either `'ABORT'` or numeric `20`, or the string only appearing inside `.message`). None of them caught the `code: 20` shape, so navigating away while a message fetch was in flight logged a spurious console error every time. Consolidated into one shared, robust `isAbortError()` helper and verified fixed for real client-side navigation (confirmed via a monkey-patched `console.error` while clicking an in-app nav link, not just re-reading the code).

**Checked and confirmed already correct (no change needed):**
- Milestone form field label/id association (Phase 4 fix) — verified live: all four fields (`milestone-title-0`, `milestone-amount-0`, etc.) carry correct `id`s in the actual rendered DOM.
- The Create Project submit button is legitimately `disabled` until the form is valid — required fields are marked with `*`, which is adequate; this is standard behavior, not a bug, despite initially looking like one under scripted testing.
- Two things that looked like duplicate-button/duplicate-tab-content bugs during testing turned out to be artifacts of the test method itself (an accessibility-tree quirk exposing an element via two roles; and the dashboard intentionally keeping all visited tab panels mounted for state preservation) — documented so a future pass doesn't re-chase the same false leads.

**What this pass deliberately did not do:** re-run the full responsive audit (already verified clean at 375px/768px with zero overflow in an earlier phase of this engagement) or redesign any visual surface — per instructions, nothing was restyled that wasn't already broken.

---

## 2k. Extended interactive testing pass (2026-08-11, continued)

Continued the live testing pass into more dashboard tabs, project states, and the public Explore page. Same rules as before: real client session, no financial transfers triggered, honest reporting of what couldn't be verified.

**Bugs found and fixed:**

6. **Stray dialog leaking across tabs.** Navigating straight to `?tab=artists` showed the "Create New Project" dialog floating on top of the Saved Artists list, with no dialog-related param in the URL. Root cause: dialog-open state is persisted to `sessionStorage` and restored unconditionally on every full mount — unlike the tab-restore logic immediately above it in the same effect, which correctly skips itself when the URL already specifies a tab. Fixed by applying the same guard: only restore Projects-tab dialogs (create project, project detail, artist assignment) when the URL has no tab or explicitly points at Projects; otherwise the stale state is cleared. Verified both directions live: the leak is gone, and the legitimate case (refreshing the Projects tab while the dialog is open) still restores it correctly.
7. **Four more icon-only buttons with no accessible name**, missed by the earlier scanner because it filtered on `size="icon"` and these don't all use that prop: the navbar message badge, the notification bell, an artwork card's save/bookmark button, its "more options" menu trigger, and the user-avatar account-menu trigger. All labelled now (message/notification counts are reflected in the label, e.g. "Notifications, 3 unread").

**Verified correct, evidence-based:**
- The overdue-deadline fix from the first pass generalizes correctly: a real project 136 days past its deadline now reads "136 Days Overdue" instead of a negative number.
- The budget-mismatch-warning fix is correctly conditional: it still shows on an active, editable project and correctly disappears only once a project reaches a terminal state.
- Grid/List view toggles, artwork save/more-options buttons, and milestone form field IDs from earlier fixes all confirmed present and correct in the live DOM, not just in source.

**What I could not verify, honestly:**
- **Milestone Review and Dispute dialogs** were not reachable. Checked 4 different projects; every milestone was `LOCKED` or `WAITING_FUNDS`, none `ACTIVE`/`REVIEW_PENDING`. Reaching those requires either funding a milestone (a real Razorpay payment, which I will not trigger) or artist-role access to submit work (credentials not available). Their logic was reviewed and fixed at the policy/trigger level in earlier phases, but not exercised end-to-end through the UI this session.
- **The Explore page's category filter** produced inconsistent results under automated testing — it opened via one interaction method and not another, and a selection didn't visibly update the trigger text on the one attempt where the dropdown did open. The underlying `TopFilters.tsx` state logic is a textbook-correct controlled `Select` with no bug visible in the code, and Radix's portal-based `Select` is a known-difficult target for synthetic automation (sensitive to exact pointer-event sequencing in a way its `Tabs`/`DropdownMenu` siblings weren't in this same session). I'm not confident enough in either direction to claim a fix or dismiss it as fine. **Recommend a manual check**: open `/explore`, pick a category from the dropdown, and confirm both that the trigger label updates and that the artwork grid actually filters.
- **Artist-side and admin-side dashboards** were not tested at all — no credentials for those roles were available in this session.
- Settings/Payments sub-tabs under Account showed inconsistent click-registration during scripted testing; investigated for a polling/remount bug and found none in the source, so this is most likely the same automation-vs-Radix friction as the category filter rather than a confirmed defect.

---

## 2l. Testing infrastructure + a root-caused false alarm (2026-08-11, continued)

### Added `data-testid` to core flows
The codebase had essentially no stable test selectors (3 occurrences total, two of them identical). Added `data-testid` to the login form (form, email, password, password-toggle, Google button, submit), the signup form (same set plus confirm-password), the six main dashboard tabs, and the three Account sub-tabs (Profile/Payments/Settings) and two My-Works sub-tabs (Purchased/Wishlist). No UI changed — attributes only.

While wiring these up, found and fixed two more real, silent accessibility gaps: the password show/hide toggle buttons on **both** Login and Signup (Signup has two — password and confirm-password) had no `aria-label`, so a screen reader announced them with no name at all.

### IMPORTANT: retracting the earlier "possible bug" on Tabs/Select interaction

Prior notes in this report speculated that clicking dashboard tabs or the Explore category `Select` might be a genuine application bug, based on repeated failures to change `data-state` via automated testing. **This is now conclusively disproven, and the flag is retracted.**

Root-caused by escalating through every layer: confirmed the click lands on the exact right element (no overlay/disabled/z-index issue); confirmed no duplicate DOM nodes; confirmed the element isn't remounting; confirmed a plain vanilla `<button>` created fresh in the same page also doesn't receive focus from `.click()` (a DOM-spec quirk, not evidence of brokenness); confirmed native `click` events do reach the element via a capture-phase listener; and finally confirmed Radix's `TabsTrigger` activates on **`onMouseDown`**, not `onClick` — it has no `onClick` prop at all. The DOM's native `.click()` method only ever fires a `click` event, never `mousedown`, so it could never have activated this component. Manually dispatched `mousedown`/`mouseup` pairs (and even genuine CDP-driven hardware clicks through the browser tool) still didn't flip the state — but **calling the actual React `onMouseDown` prop function directly, bypassing all event dispatch**, flipped `data-state` to `active` immediately, with no exception.

That last test is decisive: the same handler, on the same element, works perfectly when invoked. The failure was entirely in how automated tooling in this session simulated a "click" — none of the methods tried produced an event shape that satisfies whatever Radix checks internally on a real mousedown (likely something in how a genuinely-trusted browser event differs from a constructed one at the point React's delegated listener reads it). This is a testing-method limitation, not a defect a real person clicking with a real mouse would ever encounter.

**Practical consequence:** any future automated testing of this app's `Tabs`/`Select`/similar Radix primitives should not conclude "broken" from a `.click()` or `dispatchEvent` failing to change visible state — that pattern reliably produces false positives here. Prefer testing via the resulting `onValueChange` callback's effect (e.g., navigate via URL params where the app supports it, as this report's own earlier passes did successfully) or a tool that dispatches genuine OS-level input events with full press/release semantics.

---

## 3. Broken functionality fixed

| Issue | File | Impact |
|---|---|---|
| `LogoLoader` used but never imported | `src/pages/ClientDashboard.tsx` | **`ReferenceError` on every client dashboard load** — a crash on the app's main authenticated screen |
| Message bubbles read non-existent fields (`participantAvatar`/`participantName`; the type exposes `otherUser`) | `MessagingModule.tsx` | Every incoming message rendered with no avatar and no sender name |
| Signup had no terminal state when email confirmation is required | `Signup.tsx`, `AuthContext.tsx` | Submit button spun forever; user never told to check their inbox. Now a proper "Check your email" screen with a route to sign-in and a way to correct a mistyped address |
| `types.ts` missing `disputes.previous_status` (added by migration `20260716000000`) | `src/integrations/supabase/types.ts` | Blocked typechecking of the dispute-withdraw path |

**The repository did not typecheck cleanly before this pass.** Five pre-existing errors existed in untouched files; all are now fixed, so `tsc --noEmit` is clean and a CI typecheck gate can be added.

---

## 4. Files changed

**Modified (19):** `MessagingModule.tsx`, `ProjectDetailModal.tsx`, `MilestoneWorkflow.tsx`, `MilestoneSubmissionDialog.tsx`, `MilestoneReviewDialog.tsx`, `DisputeDialog.tsx`, `AuthContext.tsx`, `useRealtimeMessages.ts`, `integrations/supabase/types.ts`, `ClientDashboard.tsx`, `Signup.tsx`, `artist-gpt-chat/index.ts`, `create-checkout-session/index.ts`, `razorpay-webhook/index.ts`, `resolve-dispute/index.ts`, `stripe-webhook-handler/index.ts`, `universal-chatgpt-assistant/index.ts`, `verify-artwork-payment/index.ts`, `verify-razorpay-payment/index.ts`

**Added (12):** `20260810120000_security_rls_hardening.sql`, `20260810130000_api_rate_limiting.sql`, `20260810140000_enforce_user_blocks.sql`, `20260810150000_storage_upload_limits.sql`, `20260810160000_restrict_public_email_exposure.sql`, `_shared/rateLimit.ts`, `src/components/auth/AuthLinkErrorHandler.tsx`, `docs/PROJECT_CONTEXT.md`, `docs/FLOWS.md`, `docs/IMPLEMENTATION_REPORT.md`, `docs/VERIFY_PRODUCTION_RLS.sql`, `docs/VERIFY_PRODUCTION_RLS_PART2.sql`

**Deleted (1):** `src/queryClient.tsx` (dead, conflicting cache config)

---

## 5. Deployment notes — read before shipping

### 5.-1 STATUS: APPLIED ✅
All five migrations were applied to production on 2026-08-11 in a single transaction, with 14/14 verification checks passing. Details in §5.2f. The guidance below on **not** using `supabase db push` still stands for any future schema change.

### 5.0 ⚠️ CORRECTION: do NOT run `supabase db push`

**Earlier in this work I recommended `supabase db push`. That advice was wrong and would likely have damaged production.** Verified against the live project (`sqdzemlcqesgjsybbhte`, CLI authenticated and linked):

`supabase migration list --linked` reports **zero exact matches** between the 65 migration files here and the 87 migration versions recorded in production. Most is benign version drift — Lovable applies remotely first, then writes the file with a timestamp 1–3s later, and **45 of the 65 match within 5 seconds**. But the CLI matches on exact version string, so it believes all 65 are unapplied and `db push` would **replay every one**, including the 45 already applied. Several are not idempotent:

- `CREATE TABLE public.users` without `IF NOT EXISTS` — in three separate files
- `CREATE POLICY` with no preceding `DROP POLICY IF EXISTS`
- `DROP TYPE IF EXISTS public.subscription_tier CASCADE` — would drop dependent columns

**Apply the four new migrations individually via the Supabase SQL editor instead.** They are written to be idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`), so they are safe to run standalone and safe to re-run.

### 5.1 Verify production first
Run [`docs/VERIFY_PRODUCTION_RLS.sql`](VERIFY_PRODUCTION_RLS.sql) (read-only) before applying anything. It answers the original `withdrawals` / `profiles.account_status` question and confirms every object the new migrations depend on.

**The drift is per-object, not per-file** — you cannot tell what is deployed by reading filenames:

| Object | In production? |
|---|---|
| `exclusive_memberships` table | **Yes** — although its migration file shows as unapplied |
| `admin_audit_logs` table | **Yes** |
| `milestone_status_v2` enum | **No** — so milestone status is unvalidated `text` in production |
| `artist_services` currency columns | **No** |

### 5.2 Live bug this uncovered — dispute raising may be broken right now
`DisputeDialog.tsx:108` **inserts** `previous_status` when a dispute is raised, and `:219` selects it. That column comes from `20260716000000_audit_fixes.sql`, which shows no production counterpart and is absent from the generated types. If it is genuinely missing, **raising a dispute fails outright in production** — the INSERT references a non-existent column.

This was signalled by a TypeScript error, which I silenced earlier by hand-adding `previous_status` to `types.ts` on the assumption the migration had been applied. That was the wrong call: the type error was correct, and patching it hid a live defect. `20260810120000` now begins with an idempotent `ADD COLUMN IF NOT EXISTS` to close it either way.

The same migration also carries the `razorpay_accounts` column-lock (`payouts_enabled` / `kyc_status`). The security audit reported that fix as "confirmed present" — that conclusion was drawn from the repo, and **it may not be live**. §1 of the verification script settles it.

### 5.2b CONFIRMED AGAINST PRODUCTION — deliverable buckets are public (Critical)

Verified by running §7 of the verification script against `sqdzemlcqesgjsybbhte`:

| bucket | public | file_size_limit | allowed_mime_types |
|---|---|---|---|
| `artworks` | true | NULL | NULL |
| `avatars` | true | NULL | NULL |
| `media` | true | NULL | NULL |
| **`milestone-submissions`** | **true** | NULL | NULL |
| **`project-files`** | **true** | NULL | NULL |

**Two audit conclusions were wrong.** The security audit reported `project-files` and `milestone-submissions` as private, reasoning that the migration created them with `public=false` and that a later attempt to flip `project-files` to public used `ON CONFLICT DO NOTHING` and therefore "silently did not take effect — bucket remains private, confirmed safe." Production says otherwise: both are public.

**Impact:** milestone deliverables — the work a client funds through escrow — are readable by anyone with the URL, before payout and irrespective of dispute state. The same applies to client project material in `project-files`. These are served via `getPublicUrl`, so the URLs are unsigned and stable.

This is a confidentiality failure in the core escrow product, not a hardening nit. Fixing it properly means flipping both buckets to private and serving membership/participant-gated **signed** URLs — the same architectural change already identified for `exclusive_memberships` (§6). Flipping the buckets alone would break every existing `getPublicUrl` call site, so the two must land together.

Also confirms the Phase 2 finding: no bucket has a size or MIME limit. Migration `20260810150000` addresses that, and is unaffected by the public/private question.

### 5.2c PRODUCTION VERIFICATION RESULTS (2026-08-11)

Ran the verification script against `sqdzemlcqesgjsybbhte`. This corrected three audit findings and surfaced one new Critical issue.

**RESOLVED — `withdrawals` is not exploitable.** RLS is ON with exactly two policies: INSERT and `SELECT USING (auth.uid() = user_id)`. There is **no UPDATE policy**, so no user can alter a withdrawal's status. The self-approval concern that blocked sign-off is closed. (One residual question — whether the INSERT policy constrains `status` — is in Part 2.)

**CORRECTED — RLS was already enabled everywhere.** The data-model audit's central claim was that RLS had never been enabled on `user_roles`, `sales`, `tasks`, `artwork_likes`, `razorpay_orders`, `razorpay_payments`, making their policies inert. Production shows **all 20 checked tables have RLS ON**, each with policies. The audit reasoned from the absence of `ENABLE ROW LEVEL SECURITY` in the migration files, but this schema was largely applied out-of-band, so file absence proves nothing.

This mattered: migration `20260810120000` originally added SELECT/INSERT/DELETE policies to `sales` and `artwork_likes`. Because permissive RLS policies are **OR'ed**, adding `"Anyone can read artwork likes" USING (true)` beside the existing three would have **widened** read access. Those sections have been removed. **Verifying first prevented shipping a regression.**

**CONFIRMED — three weak UPDATE policies are live.** `with_check = NULL` means only the pre-update row is validated, so any column can be rewritten:

| Policy | Consequence |
|---|---|
| `users.Allow user to update own profile` | `UPDATE users SET role='admin'` on self |
| `project_milestones.Users can update milestones for their projects` | Escrow status/amount tampering by either party |
| `disputes.Admins can update disputes` | Admin-only, so low risk, but unconstrained |

**NEW CRITICAL — `profiles` has the same hole, and it is worse.** Production policy `"Users can update their own profile"` has `with_check = NULL`. The audit flagged `users.role` but missed this, and **`profiles.role` is the role the application actually reads** (`useProfile` → `useUserRole`; `users` is the parallel legacy table). So:

```sql
UPDATE profiles SET role = 'premium' WHERE id = auth.uid();
```

`premium` is the Pro-artist tier carrying a **0% platform fee**. Any user can grant themselves free commissions — an economic escalation, not merely a permissions one. Now fixed in `20260810120000` §5b, reusing the exact production policy name so it replaces rather than supplements.

**CONFIRMED — dispute raising is broken in production.** `disputes.previous_status` is **MISSING**. `DisputeDialog.tsx:108` inserts it when raising a dispute, so that INSERT fails against a non-existent column. **Raising a dispute does not work at all right now.** The idempotent `ADD COLUMN IF NOT EXISTS` in `20260810120000` §8a fixes it.

**CONFIRMED — milestone status is unvalidated free text.** `project_milestones.status` is `text`, and `milestone_status_v2` does not exist in production (the enum list contains `app_role`, `artwork_status`, `dispute_status`, `subscription_tier`, `user_role` only). So the escrow lifecycle has no database-level validation — the `enforce_milestone_transition` trigger becomes the only guard. The trigger casts via `::text`, so it works correctly either way.

**All 19 dependency checks passed**, so the migrations will not fail on a missing table, column or function.

### 5.2e PART 2 RESULTS — caught two errors in my own migration

Running Part 2 was worth it: the exact policy text corrected two things that would have shipped broken, and revealed that three notifications added in Phase 2 never worked.

**1. `artwork_unlocks` — my DROP targeted the wrong policy name.** The repo calls it `"Service role can insert unlocks"`; production carries `"Users can insert their own artwork unlocks"` (INSERT, `authenticated`, `WITH CHECK (auth.uid() = user_id)`). The original migration would have matched nothing, **left the free-artwork hole wide open, and still reported success** — precisely the failure mode Part 2 existed to rule out. Now drops both names.

The live check is slightly tighter than the audit described — a user can only unlock *for themselves* — but the hole is identical, since nothing ties the row to a payment.

**2. `transactions` — dropping the policy would have broken Stripe checkout.** The name matched, but `create-checkout-session` builds its client with `SUPABASE_ANON_KEY` **plus the caller's session, not the service role**, so its pending-transaction insert runs through RLS *as the user*. Removing the policy would have blocked every Stripe checkout for artwork and milestones. Replaced instead with `WITH CHECK (auth.uid() = buyer_id AND status = 'pending')` — permits the legitimate insert, blocks the forged `status='success'` row. Promotion to success happens only in the webhook, under the service role.

**3. NEW — `withdrawals` insert-time forgery.** No UPDATE policy exists (so rows can't be edited later, which is why this isn't self-approval), but INSERT is `WITH CHECK (auth.uid() = user_id)` with no constraint on `status`, and `status` is plain text with no CHECK. A user can create a withdrawal **already marked approved/paid, for an arbitrary amount**. Now pinned to `pending` with `amount > 0`.

**4. CORRECTED, and it breaks my Phase 2 work — `notifications`.** The audit claimed `WITH CHECK (true)`, i.e. anyone could forge a notification to anyone, and rated it Medium-High. **That is wrong — the opposite is true.** Production is `WITH CHECK (auth.uid() = user_id)`: a user may only notify *themselves*.

Consequence: every notification the app sends to the other party **fails RLS and is discarded**. That includes the three I added in Phase 2 (milestone submitted, revision requested, dispute raised) — I wrapped them in try/catch, so they fail silently and I did not detect it — plus the pre-existing inserts in `ProjectManagement.tsx` / `ClientDashboard.tsx` and every admin notice from `UserGovernance`, `ContentModeration`, `UserWarningsManagement` and `DisputeSettlement`.

So the audit's notification-coverage table is unreliable: code that inserts a notification for another user has never worked in production. Fixed by widening the policy to allow notifying yourself, a project counterparty, or (as admin) anyone — no call-site changes needed. Counterparties can already message each other directly, so this grants no new reach.

**5. NEW CRITICAL — every user's email address is readable by anonymous callers.** Policy `"Public can view user directory"`, SELECT, roles `anon,authenticated`, `USING (true)` on `public.users`, whose `email` column is `NOT NULL`.

The publishable anon key ships in the client bundle, so anyone can issue

```
GET /rest/v1/users?select=email,name,role
```

and enumerate the entire user base. No authentication required. This is mass PII exposure, and the app footer explicitly claims DPDP 2023 compliance.

**The mitigation already existed and is being bypassed.** Migration `20251225220439` created the `public_users` view — its own comment reads *"to hide email from public queries"* — projecting every column of `users` except `email`. But `20260701200048` then set `security_invoker = true` on that view. A `security_invoker` view runs with the caller's privileges, so anonymous reads of `public_users` only work if anon can also read the underlying `users` rows. The `USING (true)` policy provides that. **The row access required to keep the safe view working is the same access that exposes the raw table** — and the projection is trivially bypassed by querying `users` directly.

Fixed in `20260810160000_restrict_public_email_exposure.sql` using **column-level grants**, because RLS filters rows and cannot hide a column:

- the row policy is left untouched, so row visibility — and therefore the view's behaviour — is unchanged;
- anon's table-wide `SELECT` is replaced with an explicit column list omitting `email`;
- `public_users` keeps working for anonymous visitors (every column it projects is granted), so its only consumer, `FollowersList.tsx`, is unaffected.

**Now covers `authenticated` as well.** The row policy is `USING (true)` for that role too, so any logged-in user could scrape every email — the same mass exposure behind a free signup. All three edge functions that read `public.users` were checked first; each uses `SUPABASE_ANON_KEY` in caller context and is therefore subject to these grants:

| Function | Query | Effect |
|---|---|---|
| `get-artist-dashboard-stats` | `select('role')` | unaffected |
| `report-content` | `select('id')` | unaffected |
| `update-user-profile` | `select()` — i.e. `SELECT *`, **included email** | narrowed to an explicit column list |

That last one would have broken profile updates. It is now an explicit column list; it only ever reads the caller's own row (`.eq('id', user.id)`), so nothing is withheld from the user. It also turned out to have **no caller anywhere in `src/`** — a second orphaned edge function alongside `artist-gpt-chat` — so its response shape constrains nothing.

Nothing in `src/` reads `public.users` directly (0 call sites), and users still get their own email from the session (`auth.users`), which is where the client already reads it. That is what makes this safe to tighten for both roles.

**Policy names confirmed correct** for `users."Allow user to update own profile"`, `profiles."Users can update their own profile"` and `project_milestones."Users can update milestones for their projects"`, so §5, §5b and §9 substitute rather than supplement.

Also noted: `profiles."Master Admin Full Access"` gates on the JWT claim `app_metadata.user_role = 'admin'` — a *third* admin mechanism alongside `is_admin()` and `profiles.role`. Not exploitable (`app_metadata` is service-role-only), but it adds to the identity fragmentation described in PROJECT_CONTEXT §4.

### 5.2d Verification complete
[`docs/VERIFY_PRODUCTION_RLS_PART2.sql`](VERIFY_PRODUCTION_RLS_PART2.sql) — the migration closes two holes by dropping *named* policies (`"Allow buyers to create transactions"`, `"Service role can insert unlocks"`). Those names come from the repo; production was applied out-of-band. **If the live names differ, `DROP POLICY IF EXISTS` silently no-ops and the holes stay open while the migration still reports success.** Part 2 returns the real names, plus the `withdrawals` INSERT `with_check` (whether a user can insert an already-approved withdrawal — `status` is plain text with no CHECK constraint).

### 5.2f APPLIED TO PRODUCTION (2026-08-11) — all checks pass

The combined migration was applied via the SQL editor inside a single transaction. **14 of 14 verification checks now pass**, confirmed with `has_column_privilege()` and raw `pg_class.relacl` / `pg_attribute.attacl` inspection:

| Change | Status |
|---|---|
| `disputes.previous_status` added — **dispute raising works again** | ✅ |
| Escrow state-machine trigger installed | ✅ |
| Blocked-messages trigger installed | ✅ |
| `artwork_unlocks` client INSERT removed (free-artwork hole closed) | ✅ |
| `users.role` + `profiles.role` self-promotion blocked | ✅ |
| `transactions` / `withdrawals` INSERT pinned to `pending` | ✅ |
| Cross-user notifications permitted | ✅ |
| `check_rate_limit()` live | ✅ |
| Storage size caps + MIME allowlists | ✅ |
| `users.email` not selectable by `anon` or `authenticated` | ✅ |
| `users.name` still selectable by `anon` (view intact) | ✅ |

Final ACL state on `public.users`: `relacl` = `anon=awdDxt/postgres` — **no `r`**, so table-level SELECT is revoked; `email` has no column ACL and therefore inherits that absence; `name` carries `{anon=r,authenticated=r}` from the explicit column grant. Exactly the intended shape.

**Two false alarms, both caused by my own verification query.** It checked `information_schema.column_privileges` for *any* privilege on `email` without filtering `privilege_type = 'SELECT'`. Since `anon` still holds INSERT/UPDATE/REFERENCES on the table, the view returned rows for `email` under those privilege types and the check reported FAIL twice while the revoke had in fact worked from the first run. The fix that "didn't apply" had applied correctly both times.

The verification block now uses `has_column_privilege()`, which answers the real question — can this role read this column — and accounts for table grants, column grants, `PUBLIC` and role inheritance. Lesson worth keeping: for privilege questions, test the *effective* permission, not the catalog metadata.

Two corrections were caught **before** applying, which is the value of having verified rather than pushed: the `artwork_unlocks` policy name (would have left the hole open while reporting success) and the image-only MIME allowlist on the `artworks` bucket (would have broken audio and video artwork uploads, a shipped feature).

### 5.2g New hardening note — `anon` holds write grants on `users`
Surfaced by the ACL dump: `relacl` gives both `anon` and `authenticated` `a`/`w`/`d` — INSERT, UPDATE and DELETE — on `public.users`. Those are currently gated only by RLS: there is no DELETE policy, so deletes are denied, and INSERT/UPDATE are scoped to the caller's own row.

So it is not exploitable today, but the grants are broader than the policies need, and any future policy loosening would immediately become a write vulnerability. Tightening to `REVOKE INSERT, UPDATE, DELETE ON public.users FROM anon` deserves its own change, after checking whether any anon-context flow writes to that table (signup goes through `auth.users` and the `handle_new_user` trigger, which runs as the definer, so it likely does not).

### 5.3 Other notes
1. **The four migrations are not applied.** Apply individually per §5.0, in staging first — the milestone and block triggers change write behaviour for both parties.
2. **Order matters:** apply the migrations *before* deploying the edge functions, since `_shared/rateLimit.ts` calls `check_rate_limit()`.
3. **`npm ci` currently fails** on a Storybook peer-dependency conflict (v8 addons vs. v10 core). `npm install --legacy-peer-deps` was required to build/verify. This is a genuine pre-existing break and is why the Chromatic CI job cannot be working.
4. **Behaviour changes users will notice** (all intentional, all fixing money bugs):
   - The project-detail "mark complete" toggle now releases a real payout, and can no longer be un-done.
   - Milestone status can no longer be edited arbitrarily by participants.
   - `artist-gpt-chat` now requires authentication.

---

### 5.4 Design-system adoption: project workflow

- **Project Management now uses the shared primitives.** Its section header is rendered by `PageHeader`, its active/pending/completed tabs use `EmptyState`, and the irreversible decline action uses `ConfirmDialog`. This removes competing empty-state and confirmation-dialog implementations without changing project queries, status transitions, or action handlers.
- The pending empty state now says what will appear and how the artist can improve discovery; the completed state explains where client feedback will appear. These are product-flow clarifications, not new functionality.

### 5.5 Notifications: clearer feedback and safer navigation

- **Notification Center now uses the shared `PageHeader`, `EmptyState`, and `RetryableError` patterns.** A failed fetch no longer impersonates an empty inbox: users see a clear retry state, while a genuine empty inbox explains which updates will appear there.
- **Navigation now remains within the SPA.** Selecting a linked notification uses the router instead of assigning `window.location.href`, preserving the application shell and avoiding a full document reload.
- **Mutation feedback is explicit.** Mark-all-read disables while saving, and failed read updates show an actionable error instead of only writing to the console. The per-item read action now has an accessible name.
- Verification: `npx tsc --noEmit -p tsconfig.json` passed. The two active payment suites also pass (12/12); the all-suite invocation timed out without test output, so the active suites were run explicitly.

### 5.6 Settings: form correctness and shared hierarchy

- **Fixed an artist password-change dead end.** The handler correctly verifies the current password before changing it, but the settings screen did not render a current-password field. The form now exposes that required value, labels it correctly, and keeps the submit action disabled until all three password values are present.
- **Client settings labels now target their controls.** All password inputs have stable IDs, and the Message Alerts label now points to its switch instead of an unrelated ID.
- Both settings headers use the shared `PageHeader` pattern. The artist Pro call-to-action now uses the documented brand-gradient token rather than a local violet/indigo gradient.
- Verification: `npx tsc --noEmit -p tsconfig.json` and `git diff --check` passed.

## 6. Remaining known issues

### Not fixed — needs a product decision
- **Google OAuth signup forces every user to `client`.** Artists have no self-service correction. Requires deciding between a post-OAuth role step or threading role through OAuth state.
- **`auto-approve-milestones` is dead code** — nothing invokes it, yet the UI promises artists their milestone "will be auto-approved on [date]". Either schedule it (`pg_cron`) or remove the promise.
- **Notification INSERT policy is permissive** — a user can forge a notification to any user. Deliberately left alone: ordinary users legitimately insert notifications for project events in the current design, so tightening it means moving notification creation server-side. That is a refactor, not a policy tweak.
- **Dispute "favor artist" split is hardcoded 85/15**, ignoring an artist's Pro (0% fee) status.

### Not fixed — verified real, needs its own pass
- **Private content served from public buckets** — one architectural fix covering three findings, now confirmed against production:
  - `exclusive_memberships` gating is client-side only (Phase 2);
  - `milestone-submissions` is public, exposing escrowed deliverables (§5.2b);
  - `project-files` is public, exposing client project material (§5.2b).

  All three share a root cause: media is served via `getPublicUrl` from public buckets, so no table-level policy can restrict it. The fix is to make these buckets private and serve participant/membership-gated **signed** URLs. Deliberately not attempted piecemeal — flipping buckets without migrating the URL call sites breaks every render path, and adding RLS without changing storage leaves the files fetchable anyway. This should be scoped as one deliberate change.
- **No cancellation UI** for either subscription rail.
- **Warnings/bans may not be enforced** outside the admin UI badge.
- **Audit-log viewer is never rendered**, and the two money-moving functions don't write to that table.
- **`project-files` is a public bucket** holding client project material — likely wrong for private project work, but changing it needs a check of how those URLs are consumed.
- **Deliverable buckets have no MIME allowlist** (size cap only) — needs an agreed list of accepted delivery formats.
- **`ui/checkbox.tsx` locks every checkbox to 18×18** via inline `max*` styles, below the WCAG 2.5.8 AA 24×24 minimum and unoverridable by consumers. Mitigated by clickable labels where they exist. Needs a design decision (see Phase 6).

### Requires running one SQL script against production
Now actionable rather than blocked — see [`docs/VERIFY_PRODUCTION_RLS.sql`](VERIFY_PRODUCTION_RLS.sql) and §5.

- **RLS on `withdrawals` and `profiles.account_status`** — still unconfirmed. `withdrawals` has no `CREATE TABLE` anywhere in the repo, so it was created out-of-band and its protection is unknown. If RLS is off, a user may be able to self-approve a payout. §1 and §3 of the script answer this. **Highest priority.**
- **`disputes.previous_status`** — may be missing in production, which would break dispute raising entirely (§5.2). §5 of the script confirms.
- **`razorpay_accounts` column-lock** — reported as fixed based on the repo, but ships in a migration that may not be applied. §2 of the script confirms.
- **Migration ledger reconciliation** — 87 production versions have no file here; 20 files have no production counterpart. Until reconciled, `db push` is unusable and every schema change must go through the SQL editor. Worth a dedicated cleanup: `supabase migration repair` can align the ledger once you know what is actually deployed.
- **`types.ts` drift** — `artist_services` currency columns and `project_milestones.status` (typed bare `string` because the enum isn't in production). Regenerate with `supabase gen types` once the schema is reconciled; do not hand-patch, which is the mistake described in §5.2.

### Remaining after Phases 1–8
Phases 1–8 are complete (see §2a–2h). What is left, with evidence:
- **React Query adoption** — used in ~4 of ~37 fetch sites, so the configured cache protects almost nothing. A ~33-file refactor; own pass.
- **Image optimisation** — `getOptimizedImageUrl` applied to 5 of the many artwork-rendering components; the rest ship full-resolution originals as thumbnails.
- **Shared UI primitives** (`EmptyState`, `PageHeader`, `FormField`, `ConfirmDialog`) still have **zero** adopters. Either migrate or delete them — leaving them is the worst option, since two competing patterns now coexist.
- **`ui/checkbox.tsx` 18×18 target** — below WCAG 2.5.8 AA, needs a design decision (Phase 6).
- **Bundle**: `framer-motion` wraps every route via `PageTransition`, so it blocks first paint on every page despite only 3 files importing it directly; `emoji-picker-react` is statically imported for a rarely-opened picker.
- **Hardcoded demo artists** in `ArtistProfile.tsx` render fabricated follower counts at `/artist/1` and `/artist/2` on production (Phase 9).
- **Eight zero-consumer modules** (`useAsyncAction`, `lib/validation.ts`, 4 `shared/` primitives, `ProfileForm`, `TagManager`) — migrate or delete (Phase 9).

### Infrastructure
- **CI runs no lint, typecheck, or unit tests.** Now that typecheck is clean, adding that gate is cheap and high-value.
- **No error monitoring** (no Sentry or equivalent).
- **Zero test coverage** on escrow, disputes, auth, and admin — the highest-risk code. The fixes in §1 and §2 are verified by build/typecheck and code review, **not** by tests.
