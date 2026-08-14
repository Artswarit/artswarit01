# Artswarit — User Flows

Reverse-engineered from code (2026-08-10) and updated to reflect the fixes in [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md). Where a flow is incomplete or a rule is unenforced, that is stated explicitly rather than described as if it worked.

Legend: ✅ working · ⚠️ works with a known gap · ❌ broken/missing

---

## 1. Signup & onboarding

```
Signup page → choose role (artist|client) → email+password
  → supabase.auth.signUp (handle_new_user trigger creates profiles row)
  → [confirmation required?]
       yes → "Check your email" terminal screen ✅ (fixed)
       no  → auth state change → redirect by profiles.role
  → ProtectedRoute gates every page
  → optional, dismissible ProfileCompletionWizard
```

- ✅ Email/password signup now ends in an explicit "Check your email" state, with links to resend the link, use a different address, or sign in. Previously the submit button spun forever with no terminal state.
- ✅ **Fixed:** expired/reused verification links (`#error=...&error_code=otp_expired`) are caught globally, explained in plain language, and routed to the resend page. Previously silently dropped on `/`.
- ✅ **Fixed:** logged-out users can now request a fresh verification email from `/verify-email` (self-service form, prefilled via `?email=`). Previously this was a dead end — the page demanded a session an unconfirmed user couldn't obtain.
- ❌ **Google OAuth discards the chosen role.** `handle_new_user` always defaults to `client` before the client-side fixup can apply the selection, so artists signing up with Google land as clients with no self-service correction. Needs a product decision (post-OAuth role step vs. passing role through OAuth state).

## 2. Artwork purchase

```
Explore / Categories / ArtistProfile → ArtworkDetails → PayArtworkButton
  ├─ Razorpay: create-artwork-order (writes artwork_id into order notes)
  │    → Razorpay checkout → verify-artwork-payment
  │    → server re-fetches the order, derives artwork from notes ✅
  │    → idempotent unlock insert → artist notified
  └─ Stripe: create-checkout-session → hosted checkout
       → stripe-webhook-handler → transaction success, artwork archived,
         unlock inserted, both parties notified
```

- ✅ **Fixed:** verification no longer trusts a client-supplied `artworkId`; it reads the artwork from the Razorpay order and rejects mismatches. Repeat verification is idempotent.
- ✅ **Fixed:** Razorpay artwork purchases now have a webhook fallback — if the client callback never runs (tab closed, network dropped), the webhook resolves the order from Razorpay and completes the unlock. Previously the payment was captured and the unlock lost permanently.
- ✅ **Fixed:** Stripe no longer charges an INR-priced artwork as raw USD (a ₹5,000 artwork billed $5,000). It converts using the same rate logic as the Razorpay path and records the converted amount.
- ✅ **Fixed:** Stripe checkout now pre-checks availability (can't re-buy what you own) and verifies the caller is the project's client on the milestone branch.
- ✅ **Fixed:** the Stripe webhook's DB writes are error-checked and idempotent, and the unlock is now recorded *before* the artwork is archived — a failure between the two previously left the artwork unavailable **and** unowned.
- ⚠️ Inconsistent "sold" semantics remain: Stripe archives the artwork (single-buyer); Razorpay does not (re-unlockable).

## 3. Milestone / escrow project

```
Client: CreateProjectForm → project + milestones
        (milestone 0 = WAITING_FUNDS, rest = LOCKED)
Client: PayMilestoneButton → create-milestone-order → Razorpay
        → verify-razorpay-payment AND/OR razorpay-webhook
        → milestone WAITING_FUNDS → ACTIVE (funds escrowed) ✅
Artist: MilestoneWorkflow "Start" → ACTIVE ✅ (fixed)
Artist: MilestoneSubmissionDialog → REVIEW_PENDING (+ auto_approve_at)
Client: MilestoneReviewDialog
        ├─ Approve → release-milestone-payout (validates client, requires
        │            REVIEW_PENDING, atomic lock, pays artist via RazorpayX,
        │            marks COMPLETED, unlocks next milestone) ✅
        └─ Request revision → REVISION_REQUESTED
Either: DisputeDialog → DISPUTED
```

Enforcement (post-fix): the `enforce_milestone_transition` trigger rejects illegal transitions and money-column edits from end users. `COMPLETED` is reachable **only** through `release-milestone-payout`, and is terminal.

- ✅ **Fixed:** "Start Milestone" wrote a legacy `in_progress` value not in the enum, so it threw on every click. Now writes `ACTIVE`, scoped to `ACTIVE`/`REVISION_REQUESTED`.
- ✅ **Fixed:** the project-detail "mark complete" toggle wrote `COMPLETED` directly — marking a milestone paid with no payout. It now calls `release-milestone-payout`. The "un-complete" direction is removed (a released payout is not reversible).
- ❌ **Auto-approval is dead code.** `auto-approve-milestones` is invoked by nothing — no cron, no scheduler. The review dialog tells the artist the milestone "will be auto-approved on [date]", which will not happen. Either schedule it (`pg_cron`) or remove the promise from the UI.
- ⚠️ No server-side notification when a milestone is submitted for review or a revision is requested.

- Project workspace feedback now uses the shared accessible empty-state and confirmation patterns. Its active, pending, and completed tabs explain what appears next; declining a request requires a consistent destructive confirmation. Project actions and business rules are unchanged.

## 4. Disputes

```
Either party → DisputeDialog → disputes row (status=open,
   previous_status = current milestone status) + milestone → DISPUTED
Withdraw   → dispute → resolved, milestone reverts to previous_status ✅ (fixed)
Admin      → DisputeSettlement → resolve-dispute
             → atomic lock ✅ → cap check ✅ → refund/payout → statuses
```

- ✅ **Fixed:** participants can now actually withdraw. Previously no participant UPDATE policy existed, so the withdraw silently affected 0 rows while the milestone revert succeeded — leaving the dispute open forever while the UI showed it resolved.
- ✅ **Fixed:** `resolve-dispute` now takes an atomic lock (no double refund/payout on retry) and refuses to disburse more than the escrowed amount. The lock is released on failure so an admin can retry.
- ⚠️ **Stripe-funded disputes only automate the client refund** — the artist payout is logged to console for manual completion.
- ⚠️ The "favor artist" split is hardcoded 85/15 regardless of the artist's Pro (0% fee) status.
- ⚠️ No DB constraint prevents two concurrent open disputes on one milestone (the guard is UI-only).
- ⚠️ No notification to the counterparty when a dispute is raised or resolved.

## 5. Messaging & notifications

- ✅ Messaging is genuine realtime (`postgres_changes`), no polling. Message bubbles now show the correct avatar and sender name (previously read non-existent fields, so both were always blank).
- ✅ **Fixed: blocking now actually blocks.** A DB trigger rejects messages in either direction when a block exists, and the UI explains why rather than showing a generic failure. Previously `user_blocks` was written but never read.
- ✅ **Fixed: missing notifications added** for milestone submitted (→ client), revision requested (→ artist), and dispute raised (→ counterparty). One of these had a toast claiming the artist was notified when nothing was sent.
- ❌ Email/push notification preferences in Settings are dead — nothing reads them. The system is in-app only, so offline users miss everything.
- ⚠️ Notifications are inserted client-side by ordinary users for project events, and the INSERT policy is permissive, so a user can forge a notification to any user. Tightening this requires moving notification creation server-side (triggers/edge functions) — deliberately **not** changed here because peer-to-peer inserts are load-bearing in the current design.

- **Notification history now distinguishes an empty inbox from a failed load.** It provides a retry action for fetch failures, clear saving feedback for mark-all-read, and client-side navigation to linked projects, profiles, or artworks.

- **Settings password changes are complete for both roles.** Both forms now collect the current password required by the secure verification step, associate every password label with its input, and disable submission until the required values are present.

## 6. Subscriptions (Pro artist)

```
create-premium-checkout (plan: pro|monthly|yearly)
  → Stripe checkout → stripe-webhook-handler
  → subscribers upsert (subscription_tier, is_active, renew_at) ✅ (fixed)
  → invoice.paid extends renew_at ✅ (fixed)
  → cancellation/expiry sets is_active=false ✅ (fixed)
```

- ✅ **Fixed:** the webhook wrote a non-existent `plan` column and omitted the `NOT NULL` `email`, so the insert always failed — Stripe subscribers were charged and shown "Premium Activated" while never becoming premium. Now upserts the correct columns, is retry-safe, sets an explicit `renew_at`, extends it on renewal, and revokes access on cancellation.
- ✅ **Fixed:** Stripe-funded *milestones* also never activated — the webhook wrote `PAID`, which isn't in the status enum, and the failure was swallowed. Now writes `ACTIVE`.
- ❌ **No cancellation UI on either rail.** `customer-portal` exists but is never called from the frontend; there is no Razorpay cancellation path.
- ❌ `exclusive_memberships` access is **client-side only**. Not patched: artwork media is served from a **public** bucket via `getPublicUrl`, so the file is reachable by URL regardless of any table policy. Fixing it properly requires private storage + membership-gated signed URLs.
- ⚠️ `AuthContext.isPremium` compares `subscription_tier === 'pro'`, but the column can only be `monthly|yearly|lifetime`, so that flag can never be true.

## 7. Admin

- ✅ Money-moving admin actions (`resolve-dispute`, `delete-artwork-and-media`) re-verify admin server-side via `is_admin()`.
- ✅ `user_roles` RLS is now actually enabled, so its admin-only policy is no longer inert.
- ❌ The audit-log viewer (`AuditLog.tsx`) is never rendered anywhere — the trail exists but is unreadable in-app, and the two functions that move money log to a different table entirely.
- ❌ No evidence warnings/bans are enforced outside the admin UI badge — a banned user may retain full access.
- ❌ No admin force-release/reversal path for a milestone stuck outside an active dispute.
- ⚠️ No financial reconciliation view (collected vs. fees + payouts + refunds + held).
- ⚠️ **Unverified:** RLS on `withdrawals` and `profiles.account_status` could not be confirmed from the migration history. Needs a direct check against the live project.

---

## Cross-cutting states

| State | Status |
|---|---|
| Loading | Full-page `LogoLoader` on dashboards; skeletons in ~17 files. Consistent but skeleton-first would be better. A missing `LogoLoader` import crashed the client dashboard on every load — fixed. |
| Empty | ~30 hand-rolled blocks; the shared `EmptyState` primitive has 0 adopters. |
| Error | `RetryableError` exists and is used in a few admin lists; most surfaces are toast-only. |
| Dark mode | ✅ Fixed. `/trending` went from 27 light regions to 0; the homepage from 14 to 3 (all intentional white CTAs). Root cause was `.glass-card`/`.glass-effect`/`.mobile-card` in `index.css` hardcoding `bg-white`, which overrode the correct token on every consumer. Light mode verified unchanged. |
| A11y | Alt text is complete. ✅ Icon-only buttons now carry accessible names (the audit's "27" was a grep artefact; the real count was 13, one of which was already correct). ✅ The hand-rolled comments sheet now has dialog semantics and Escape-to-close — it was previously impossible to dismiss with a keyboard. ✅ Milestone form fields are label-associated. Remaining: contrast/focus-visible sweep not yet done. |
