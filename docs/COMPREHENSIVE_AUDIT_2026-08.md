# Artswarit — Comprehensive Architecture, Security & Product Audit

**Date:** 2026-08-10
**Scope:** Full-codebase audit (Phases 1–11 per audit brief) — frontend architecture, data model, API/edge functions, security, business logic/product flows, UI/UX, performance, testing/gaps.
**Method:** 8 parallel research passes, each required to cite file:line evidence and cross-check against `docs/BATCH_2/3/4_AUDIT.md` and recent commit history so already-fixed items aren't re-flagged. No code was changed as part of this audit — research only.
**Status:** Research complete. Implementation has **not** started pending sign-off on the emergency batch below (see "Immediate Action Required").

---

## 0. Immediate Action Required — Live, Exploitable Issues

These are **currently exploitable on the production app** (artswarit.lovable.app) by any authenticated user, several by unauthenticated users. They are listed first, out of phase order, because they represent active financial/integrity risk, not audit backlog.

| # | Issue | Exploit | File |
|---|---|---|---|
| 1 | `artwork_unlocks` INSERT policy is `WITH CHECK (true)` | Any authenticated user inserts a row unlocking any artwork for any amount — no payment required | `supabase/migrations/20260204084346_f3c5d778-1680-44ab-9bdb-a7512cd7b9a5.sql:24-28` |
| 2 | RLS never enabled on `user_roles`, `razorpay_orders`, `razorpay_payments`, `sales`, `tasks`, `artwork_likes` | Policies exist but are inert; access governed only by default Postgres grants | (absence — no `ENABLE ROW LEVEL SECURITY` for these tables anywhere in 70 migrations) |
| 3 | `users` UPDATE policy has no `WITH CHECK` | Any user runs `UPDATE users SET role='admin' WHERE id=auth.uid()` and becomes an admin | `20250922123005_a80cf388-2241-4b97-90b1-c257ed6bba58.sql:175` |
| 4 | `transactions` INSERT policy has no status/amount constraint | Any user inserts their own row with `status='success'`, fabricating a completed purchase | `20250922123005...sql:186` |
| 5 | `project_milestones` UPDATE policy has no `WITH CHECK` | Any project participant sets `status='COMPLETED'`, `amount`, or `payout_id` directly, bypassing the payout edge function's checks. Independently confirmed by 3 of 8 audit passes (data model, security, business logic). | `20260112162215_f646c9d3-2a1e-4126-bd34-2707e9d44037.sql:77-85` |
| 6 | `verify-artwork-payment` doesn't bind `artworkId` to the paid order | Pay once for a cheap artwork, then call this endpoint with any other `artworkId` to unlock it free — repeatable indefinitely | `supabase/functions/verify-artwork-payment/index.ts:72-135` |
| 7 | `verify-razorpay-payment` doesn't validate `milestoneId` against the payment record | Any authenticated user flips any milestone on the platform to `ACTIVE` with one legitimate payment | `supabase/functions/verify-razorpay-payment/index.ts:72-162` |
| 8 | `artist-gpt-chat` / `universal-chatgpt-assistant` have no auth check and no rate limit | Unauthenticated, unbounded calls to paid LLM APIs (Gemini/Groq) — cost-abuse/DoS vector | `supabase/config.toml`; both functions' handlers |
| 9 | `notifications` INSERT policy is `WITH CHECK (true)` | Any authenticated user inserts a notification impersonating "the system" for any `user_id` — phishing/spoofing vector | `20251223195754...sql:53-57` |
| 10 | `resolve-dispute` has no idempotency guard and no server-side cap on `payout + refund ≤ escrowed amount` | A retried/duplicated request double-moves money; admin UI's overpayment guard is client-side only | `supabase/functions/resolve-dispute/index.ts:56-219` |
| 11 | `disputes` UPDATE policy is admin-only, but the client "withdraw dispute" flow calls a direct client update expecting success | The update silently affects 0 rows; the paired milestone-status revert succeeds — dispute is stuck permanently `open` in the DB while the UI shows it resolved | `DisputeDialog.tsx:186-210` vs `20260112162215...sql:246-248` |
| 12 | Stripe premium subscription writes a `plan` column that doesn't exist on `subscribers` | Insert fails silently (only logged); buyer is shown "Premium Activated" but no premium flag is ever set — Stripe subscribers pay and get nothing | `stripe-webhook-handler/index.ts:154-159` |

**Recommendation:** treat #1–5 and #9 as one emergency SQL migration (RLS `ENABLE` + `WITH CHECK` additions only — no application behavior changes for legitimate users). Treat #6, #7, #10, #11, #12 as a second emergency batch (edge-function logic fixes). Both are narrow, low-risk-to-ship, high-value-to-ship. Full remediation detail in Phase 7/Phase 11 below. **Not yet applied — awaiting your go-ahead.**

---

## Phase 1 — Architecture Analysis

### Folder structure & responsibilities

| Folder | Responsibility |
|---|---|
| `components/ui/` (55 files) | shadcn/Radix primitives + a few bespoke atoms |
| `components/dashboard/` (45+ files) | Artist/client dashboard screens — largest, most heterogeneous folder |
| `components/admin/` (31 files) | Admin console: finance, moderation, disputes, governance, audit log |
| `components/shared/` (7 files) | Batch 2/3 primitives (`EmptyState`, `PageHeader`, `FormField`, `ConfirmDialog`, `RetryableError`) — see Phase 4, adoption is at **zero call sites** |
| `pages/` (30 files) | Route containers; several do their own data-fetching instead of delegating to hooks |
| `hooks/` (32 files) | Mixed: some true reusable abstractions, others one-off page fetchers |
| `contexts/` | `AuthContext`, `CurrencyContext` — no context sprawl, but each independently subscribes to its own realtime channel on the `profiles` table |
| `providers/RealtimeProvider.tsx` | App-wide presence channel whose `onlineUsers` state has **zero consumers** anywhere in the app |
| `lib/` | Utilities, including `validation.ts` (Zod schemas, zero consumers) and `useAsyncAction` (zero consumers) — both Batch 3 primitives never adopted |
| `integrations/supabase/` | Client + generated types — clean, but **types.ts is stale** relative to applied migrations (see Phase 5) |

### State management
- React Query is configured (twice — see below) but used in **only ~4 of ~37 data-fetching sites**. The dominant pattern is hand-rolled `useState`+`useEffect`+direct `supabase.from()` calls, each reimplementing its own loading/error state.
- **Two conflicting QueryClient instances**: `src/queryClient.tsx` (staleTime 60s, 0 imports — dead file) vs. the one actually wired in `src/App.tsx:55-65` (staleTime 5min/gcTime 30min/retry 1). Medium severity — config drift risk.
- **Duplicate realtime presence systems**: `RealtimeProvider.tsx` (app-wide, unconsumed) and `useRealtimeMessages.ts` (messaging-specific) each run independent presence channels for the same concept. Plus `AuthContext` and `CurrencyContext` both subscribe separately to `profiles`-table changes.

### Routing
`react-router-dom` v6, centralized in `App.tsx`, consistent route-level lazy-loading (except the eager landing page, which is a deliberate choice), a single `ProtectedRoute` handling auth/verification/role-gating, and a thoughtful `ErrorBoundary` that force-reloads once on stale-chunk import failures after a deploy. 404 handled correctly.

### Coupling / duplication / complexity
God components mixing data-fetching, business logic, and presentation: `pages/ClientDashboard.tsx` (1295 lines, 20 `useState`, 11 raw Supabase calls), `dashboard/projects/ProjectDetailModal.tsx` (1228 lines, 19 Supabase calls), `pages/ArtistProfile.tsx` (1127 lines), `dashboard/ClientSettings.tsx` (984 lines, including a client-orchestrated 4-table cascading delete with no rollback on partial failure — `ClientSettings.tsx:409-412`). Chat UI is duplicated wholesale between `MessagingModule` and `ProjectDetailModal` (already tracked in Batch 2, still unresolved).

### SOLID/DRY/KISS violations
Data-access logic embedded directly in 33+ UI components instead of a hook/repository layer (violates SRP/DIP); two declared-but-unadopted "canonical" primitives (`useAsyncAction`, `lib/validation.ts`); two parallel test harnesses with confusingly similar names (`src/test/` = Vitest, `src/tests/` = a hand-rolled assert-based runner that `npm test` actually invokes).

### Deployment architecture
`vite.config.ts` has a genuinely mature bundling strategy (per-vendor manual chunks, tuned Workbox runtime-caching policy for PWA). `vercel.json` is a minimal SPA rewrite with no other config. **CI does not run lint, typecheck, or unit tests** — only Playwright E2E and Chromatic visual regression are wired into `.github/workflows/`. A broken build or failing unit test can merge to `main` today.

---

## Phase 2 & 3 — Business Logic & Product Flow Audit

### Auth & Onboarding
Signup → `handle_new_user` trigger auto-creates `profiles` → email verification → role-based redirect → optional dismissible profile-completion nudge. Gaps:
- Signup button stays permanently disabled/spinning when email confirmation is required — no redirect to a "check your email" screen (`Signup.tsx:108-118`).
- Expired/reused verification links (`#error=access_denied&error_code=otp_expired`) are silently dropped; `ResetPassword.tsx` handles this pattern correctly but it was never applied to signup verification.
- No way to resend verification for a logged-out user with an unconfirmed account — a genuine dead end.
- **Google OAuth signup discards role selection entirely** — the `handle_new_user` trigger always defaults to `role='client'` before the client-side fixup can run, so every artist who signs up via Google is silently registered as a client with no self-service fix.

### Artwork Marketplace (Razorpay + Stripe)
Both payment rails work end-to-end for the happy path, but diverge in ways that create real bugs:
- **Razorpay has no webhook fallback for artwork purchases** (the webhook only handles milestone payments) — a closed tab or dropped network after payment capture permanently loses the unlock with no recovery path.
- **Stripe checkout ignores artwork currency metadata** and charges `artwork.price` as raw USD cents — an artwork priced in INR could charge a Stripe buyer the full numeric value in USD (e.g., ₹5000 → $5000).
- Inconsistent "sold" semantics: Stripe purchases archive the artwork (single-buyer); Razorpay purchases never touch artwork status (infinitely re-unlockable) — same artwork behaves differently depending on payment rail.
- Zero error-handling on the four sequential DB writes inside `stripe-webhook-handler` — a failure anywhere is silent (payment captured, no unlock delivered).

### Milestone/Escrow Projects
State machine: `LOCKED → WAITING_FUNDS → ACTIVE → REVIEW_PENDING → COMPLETED`, with `REVISION_REQUESTED`/`DISPUTED` branches. Only the **payout** transition (`release-milestone-payout`) is genuinely server-validated (atomic conditional lock, real payment check). Every other transition is a direct, unguarded client `.update()` call, made unguarded specifically because the RLS policy has no `WITH CHECK` (Immediate Action #5). The advertised "auto-approval after N days if the client doesn't respond" safety valve (`auto-approve-milestones`) is **never invoked by anything** — no cron job, no scheduled trigger, zero references anywhere — so a non-responsive client can stall a milestone in review forever despite the UI telling the artist otherwise. A legacy status value (`'in_progress'`, not in the current enum) is still written by `MilestoneWorkflow.tsx:295-311`, so the "Start Milestone" button throws a DB error on every click.

### Disputes
Raising a dispute is a direct, unguarded client insert/update (no DB constraint prevents two concurrent open disputes on the same milestone, despite `BATCH_3_AUDIT.md §8` asserting this is RLS-enforced — it isn't). Withdrawal is broken (Immediate Action #11). Resolution has no server-side payout+refund cap (Immediate Action #10), and the "favor artist" 85/15 split is hardcoded regardless of whether the artist is on a 0%-fee Pro plan. For Stripe-funded escrow, dispute resolution automates the client refund but **not** the artist payout — it's merely logged to console for manual follow-up.

### Messaging & Notifications
Messaging itself is solid (genuine Postgres-changes realtime, no polling). Notification coverage has real gaps: milestone submission, revision requests, dispute raised/resolved, and payment failures never notify the relevant party, despite UI copy in some flows explicitly promising they will. `BlockUserButton`'s "they won't be able to message you" promise is not enforced anywhere in the messaging code. Email/push notification preference toggles in Settings are dead — nothing reads them; the system is in-app-only, so offline users miss everything.

### Subscriptions/Premium
Two unrelated systems: platform "Pro artist" subscriptions (Stripe/Razorpay) and a separate `exclusive_memberships` per-artist access list. The Stripe premium path is fundamentally broken (Immediate Action #12) with no cancellation UI on either rail (`customer-portal` exists but is never invoked from the frontend). `exclusive_memberships` enforcement is **client-side only** — the underlying artwork query isn't filtered by membership status, so "exclusive" content is reachable by URL/API regardless of approval state.

### Admin Governance
Money-moving actions (`resolve-dispute`, `delete-artwork-and-media`) correctly re-check admin status server-side. User warnings/bans, however, have no evidence of enforcement anywhere outside the admin UI badge — a banned user may retain full access. The audit-log viewer (`AuditLog.tsx`) is never rendered anywhere in the admin dashboard, so the trail that does exist is unreadable in-app, and the two highest-risk money-moving functions don't even write to it (they log to a different table). Could not confirm RLS protection exists at all for `withdrawals` approval or `profiles.account_status` — if genuinely absent, this is a further critical gap requiring direct verification.

---

## Phase 4 — UI/UX Audit

- **Shared-primitive adoption is at zero.** `EmptyState`, `PageHeader`, `ConfirmDialog`, `FormField` (built in Batch 2) have no import call sites anywhere in `src/` — no progress since that batch.
- **Dark mode**: recent fix commits are only partially effective. `ClientSettings`/`ClientDashboard` fixes verified clean; `ProfileCompletionWizard` still has 2 unaddressed spots in the same file the commit targeted. The identical bug fixed in `ClientSettings.tsx:506` was never applied to its structural twin `ArtistSettings.tsx:434`. New, previously-undiscovered breaks: the entire `/trending` page and its `TrendingAlgorithm.tsx` component (503 lines, 0 dark classes) render light-only; the Earnings dashboard and several forms use hardcoded `bg-white/*` glass-card overrides with no dark variant (14 sites total).
- **Accessibility**: image alt-text is actually clean (0 missing across 259 files — a non-issue). 27 icon-only buttons have no `aria-label` (chat back-button, Explore grid/list toggles, social-share icons). One hand-rolled modal (`ArtworkFeedback.tsx` comments sheet) bypasses Radix entirely — no `role="dialog"`, no Escape handler, unlabeled close button. `CreateProjectForm.tsx`'s milestone fields have no `htmlFor`/`id` pairing between labels and inputs.
- **Responsiveness**: in noticeably better shape than dark-mode/a11y — breakpoints are sensible, Playwright covers 4 device profiles, and spot-checked pages showed no new mobile-breaking issues.
- **Design-system drift**: 106 call sites use `rounded-[2rem]`/`rounded-[2.5rem]`, outside the radius scale `DESIGN_TOKENS.md` marks as "hard do not change" — used too consistently to be accidental, suggesting the documented rule is now stale rather than the code being wrong. Recommend reconciling the doc, not necessarily the code.
- **CTA clarity**: `DashboardAttentionRequired` cards compute a descriptive action label but render only an unlabeled icon chevron, so a high-severity "unread messages" card looks identical to a low-severity "finish setup" nudge.

---

## Phase 5 — Data Model Audit

Beyond the Immediate Action items (#1–5, #9 above):

- **Three parallel user-identity representations**: `users` (enum role: artist/client/admin), `profiles` (plain string role), `user_roles` (different enum: admin/moderator/artist/client, with an extra `moderator` value the other two don't have). Roughly half the schema FKs to `profiles`, the other half to `users` — no single source of truth for identity/role, and this fragmentation is the structural root cause of several of the Immediate Action items.
- **Three overlapping purchase ledgers** (`transactions`, `sales`, `artwork_unlocks`) with no cross-referencing FK between them.
- No indexes exist on any of the foreign-key/status columns used in RLS predicates for `projects`, `messages`, `conversations`, `reviews`, `subscriptions` — every row-level security check on these hot tables does a sequential scan.
- Most status columns (`disputes.status`, `projects.status`, `sales.status`, `subscriptions.status`, `reports.status`, etc.) are plain `text` with no `CHECK` constraint even where a matching enum type was created — nothing at the DB layer rejects an invalid value.
- No soft-delete pattern anywhere — a user closing their account mid-dispute cascade-deletes evidence.
- `src/integrations/supabase/types.ts` is stale relative to applied migrations in at least two confirmed places (`project_milestones.status` still typed as bare `string`, missing the `milestone_status_v2` enum; `artist_services` missing its currency columns entirely) — the frontend has no type-safe access to columns that exist in the live schema.
- Migration hygiene: 4 migration files within ~4 minutes of each other in the Sept 2025 batch each contain `CREATE TABLE public.users` — replaying the chain from empty would fail.

---

## Phase 6 — API Audit

Beyond the Immediate Action items (#6, #7, #8, #10 above):

- `stripe-webhook-handler` has no dedup/idempotency mechanism at all (unlike `razorpay-webhook`, which correctly uses a `webhook_logs` unique-constraint table) — Stripe's at-least-once delivery will duplicate `subscribers` rows and double-fire revenue analytics on retry.
- `create-checkout-session`'s Stripe milestone-payment path never checks the caller is the milestone's client — the Razorpay equivalent does. Any authenticated user can initiate a Stripe checkout against someone else's milestone.
- `posthog-insights` lets any Pro-subscribed user pass an arbitrary `artist_id` and pull that artist's private analytics — no ownership/admin check.
- `create-artist-razorpay-account` stores bank details with zero format validation and hardcodes `payouts_enabled: true` for every submission (the code comments admit this is a simulation of real KYC).
- Razorpay/webhook HMAC comparisons use plain `!==`/`===` rather than a timing-safe compare (Medium — theoretical, not currently the practical attack surface here).
- No rate limiting anywhere in the 23 edge functions.
- No refund path exists for a disputed direct artwork purchase (refunds only exist inside `resolve-dispute`, gated on a milestone being attached).
- `supabase/functions/mcp/index.ts` imports from a hardcoded Windows absolute path from the original developer's machine — non-portable, will likely fail to build in a clean environment.

---

## Phase 7 — Security Audit

**Verified as genuinely fixed** (do not re-open): hardcoded PostHog key removal, Supabase PKCE flow configuration, `window.confirm`→AlertDialog replacement, client-side milestone-unlock race removal, the `razorpay_accounts` client-escalation column lock, and the `subscribers` self-escalation fix (`20260701200048...sql`) that predates and is separate from the batches you already know about.

**New findings beyond Immediate Action / Phase 5/6 items:**
- PostgREST filter-string injection in the public AI-chatbot's search tool (`src/lib/mcp/tools/search-artists.ts:26-32`, `list-artworks.ts:35-36`) — raw user input interpolated into an `.or()` filter string. Blast radius is limited (can't bypass the hardcoded visibility filter) but can corrupt query semantics or leak schema info via parser errors.
- No server-side file-type/size enforcement on artwork, project-file, or milestone-submission storage buckets — only client-side `accept=` attributes, trivially bypassed by calling the Storage API directly with a valid JWT. Contrast with `update-user-profile`, which does this correctly.
- Weak substring-based (not exact, not constant-time) bearer-token comparison gating the cron-only `auto-approve-milestones` endpoint.
- `ResetPassword.tsx`'s recovery-link detection may not match PKCE-issued query-param reset links depending on the project's email template — a correctness bug that could lock legitimate users out of password reset, not an auth bypass.
- Password minimum length is 6 characters with no complexity requirement — a hardening opportunity, not a vulnerability.
- No SQL injection, no XSS via `dangerouslySetInnerHTML` on user content, no secrets committed to the repo, no CSRF exposure given the pure Bearer-token auth model, no environment-variable misuse (all `VITE_*` values are genuinely client-safe) — all explicitly checked and confirmed clean.

---

## Phase 8 — Performance Audit

- React Query's sensible cache defaults protect almost nothing in practice — only ~4 of ~37 data-fetching sites use it; the rest re-fetch from scratch on every remount/focus/navigation.
- `UserProfile.tsx:210-221` runs a sequential (non-parallel) loop awaiting 2 Supabase queries per client review — up to 20 sequential round-trips (1.5–3s) on one profile page load.
- `useRealAnalytics.ts` runs 12 parallel queries per artist-dashboard load, several fetching full row sets just to read `.length` instead of using `count: 'exact', head: true`.
- The landing page's hero slider renders all slides stacked and un-optimized (not routed through the existing Weserv CDN helper) — full-res images download on first paint of the most-visited page.
- Image optimization helper exists and is well-designed but is used in only 5 of the many components that render artwork images; the rest ship full-resolution originals as thumbnails.
- Only 3 components in the entire codebase use `React.memo` (2 of those 3 are actually dead/unused code); large realtime-heavy components recompute filter/reduce chains on every render with no memoization.
- **No memory leaks found** — all 79 realtime channel subscriptions across 47 files have matching cleanup calls. This was a real risk given the number of independent realtime systems (Phase 1) but checked out clean.

---

## Phase 9 & 10 — Code Quality, Testing & Gap Analysis

- **No CI gate for unit tests, lint, or typecheck** — only Playwright E2E and Chromatic run in `.github/workflows/`. `bun run test:unit`, `bun run lint`, and TypeScript compilation are never invoked in CI.
- **Escrow, dispute, auth, and admin flows have zero automated test coverage** — the only real unit tests cover the Stripe artwork-purchase button. The two flows with the most money and trust at stake are the least tested.
- The Chromatic visual-regression CI job is very likely broken — it runs `build-storybook` but no `.storybook/` config or any `*.stories.*` file exists anywhere in the repo.
- TypeScript strict mode is fully disabled (`strict: false`, `noImplicitAny: false`, `strictNullChecks: false`), and `@typescript-eslint/no-explicit-any` is explicitly turned off for `src/**` (while correctly left on for edge functions) — combined with 321 `any`/`as any` occurrences in 96 files, several touching payment/dispute/admin-metrics code directly.
- No error-monitoring service (Sentry or equivalent) is configured anywhere — errors only reach `console.error` plus PostHog's incidental exception capture.
- Several analytics events are defined in the schema but never fired (`profile_completed`, `search`, all impression events, subscription lifecycle events, `message_sent`) — an entire impression-tracking hook is built but never called.
- Admin permissions are a single boolean (`role === 'admin'`) with no moderator/support tier — every admin has equal access to disputes, refunds, and content moderation.
- SEO fundamentals are otherwise strong (full OG/Twitter/JSON-LD in `index.html`) but the page title is truncated mid-word ("Creative Servic") and there is no `sitemap.xml` for a marketplace with many deep per-artist/per-artwork pages.
- No `TODO`/`FIXME`/`HACK` markers exist anywhere in the codebase — either genuinely clean or a convention that was never used; worth confirming with whoever maintains this which it is.

---

## Phase 11 — Prioritized Action Plan

### Critical (fix before anything else — active exploitation risk on a live payments platform)
1. RLS/policy emergency migration: enable RLS on the 6 unprotected tables, add `WITH CHECK` to `users`, `transactions`, `project_milestones`, `artwork_unlocks`, `notifications` INSERT policies. *Files: new migration under `supabase/migrations/`. Effort: small (1 migration file), high care needed on the `WITH CHECK` predicates for `project_milestones` since legitimate client flows currently rely on the looseness.*
2. Fix `verify-artwork-payment` and `verify-razorpay-payment` IDOR — derive `artworkId`/`milestoneId` from the server-side payment/order record, never trust the client-supplied value. *Files: `supabase/functions/verify-artwork-payment/index.ts`, `verify-razorpay-payment/index.ts`. Effort: small.*
3. Add auth + rate limiting to `artist-gpt-chat`/`universal-chatgpt-assistant`. *Effort: small-medium (need a rate-limit mechanism — likely a DB-backed counter, since no infra for this exists yet).*
4. Add idempotency guard + payout/refund cap to `resolve-dispute`. Fix the `disputes` withdraw-policy mismatch so withdrawal actually persists. *Effort: medium.*
5. Fix Stripe premium activation (correct column name; add cancellation revocation). *Effort: small, needs a migration to add/rename the column plus a webhook-handler fix.*
6. Wire up `auto-approve-milestones` to an actual schedule (Postgres `pg_cron` or an external scheduler) — currently dead code that the UI promises is running. *Effort: small.*
7. Fix Google OAuth role assignment so artist signups aren't silently forced to `client`. *Effort: small-medium, needs an onboarding-step redesign decision, not just a bug fix.*
8. Confirm (and if absent, add) RLS on `withdrawals` and `profiles.account_status`. *Effort: unknown until confirmed — flagged as unverified from static analysis alone.*

### High
- No server-side file-type/size limits on artwork/project-file/milestone uploads.
- Razorpay artwork purchases have no webhook safety net (client-only verification).
- Stripe artwork checkout ignores currency, risking gross overcharge.
- `exclusive_memberships` gate is enforced client-side only.
- `BlockUserButton` doesn't actually block messages.
- Missing notifications for milestone submission, revision requests, dispute events, payment failures.
- No CI gate for lint/typecheck/unit tests.
- Zero test coverage on escrow/dispute/auth flows.
- Data-access logic embedded in 33+ UI components instead of a shared hook layer (architectural, large effort, no user-facing urgency).

### Medium
- Dark-mode gaps (14 sites), 27 unlabeled icon-only buttons, one non-Radix modal missing a11y semantics, `CreateProjectForm` label/input association.
- `useAsyncAction`/`lib/validation.ts` built but never adopted — either adopt or remove.
- Two conflicting `QueryClient` configs (dead file).
- Duplicate realtime presence systems.
- N+1 query patterns in `UserProfile.tsx`, `useRealAnalytics.ts`, `SavedArtists.tsx`.
- Missing indexes on RLS-predicate columns for `projects`/`messages`/`conversations`.
- Admin permissions have no tier granularity.
- Sitemap.xml missing; truncated page title.

### Low
- Two parallel, confusingly-named test harnesses.
- 106 sites using an undocumented border-radius value (likely a docs-vs-code reconciliation, not a code fix).
- Various `console.log` cleanup, minor password-policy hardening, hardcoded local path in `supabase/functions/mcp/index.ts`.

---

## What Was Explicitly Checked and Found Clean

Documenting these prevents re-litigating them in a future audit pass: no secrets committed to the repo; no classic SQL injection; no XSS via user content; no CSRF exposure (Bearer-token model); no environment-variable misuse; no memory leaks in realtime subscriptions; image `alt` text is complete; no hand-rolled dropdowns bypassing Radix; PKCE/PostHog-key/window.confirm/milestone-race fixes from prior batches are genuinely in place; money columns are `numeric`, never `float`.

---

## Phase 12 — Implementation

**Not started.** Per the audit brief's own structure ("After the audit... fix issues incrementally") and this project's own established convention (see `docs/BATCH_3_AUDIT.md`, which explicitly documents stopping to ask before touching anything outside an agreed scope), implementation is being held for explicit sign-off given:
- The Critical list above touches live payment/escrow/admin logic on a production app — a wrong fix here is worse than the current bug.
- Several fixes (RLS `WITH CHECK` predicates, dispute withdrawal policy) need to be verified against actual legitimate-user flows before shipping, not just against the exploit path.
- Two items (`withdrawals`/`profiles.account_status` RLS, base `messages`/`conversations` table RLS) could not be confirmed from the repo alone and need a direct check against the live Supabase project before any fix is written.

Recommended next step: confirm which of the Critical items to batch into an emergency fix now vs. schedule normally, per the summary sent in chat.
