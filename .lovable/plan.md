
# Admin Dashboard & Platform Audit — Execution Plan

This is a large multi-phase audit. To keep changes safe and verifiable, I'll do it in **read-only analysis passes first**, then implement small, reviewable batches with verification between each. No redesign, no business-logic rewrites — only gap-filling and consistency fixes.

## Approach

### Phase A — Analysis only (no code changes)
1. **Architecture map**: read `App.tsx` routes, `AuthContext`, `useUserRole`, `ProtectedRoute`, role gating.
2. **Lifecycle traces** — walk these end-to-end and produce a written gap report:
   - Project: `CreateProjectForm` → accept/reject → `MilestoneWorkflow` → submission → review → completion.
   - Milestone: states, auto-approval edge function, partial payments, dispute hooks.
   - Payment: Razorpay/Stripe checkout → webhooks → payout → refund.
   - Dispute: `DisputeDialog` → `disputes` table → `DisputeSettlement` → `resolve-dispute` edge function.
   - Messaging, notifications, reports, moderation, AI features.
3. **Admin capability gap matrix**: compare existing admin tabs vs platform surfaces; list what's missing (e.g. withdrawals view, feature flags, AI usage, error monitor).
4. **DB & RLS check** via supabase tools (read-only) for: project_milestones (RLS off — flagged), disputes, payments, withdrawals.
5. **White-screen root-cause sweep**: search for unguarded `lazy()` chunks, throwing render paths, `Suspense` boundaries, recent `ErrorBoundary` behavior in `App.tsx`.
6. **Loader inventory**: grep all `Loader2`, spinners, skeletons; identify where `LogoLoader` should replace them.
7. **Consistency sweep**: button heights, input heights, card radii, typography tokens across admin sub-tabs vs platform.

**Deliverable of Phase A**: a single written report posted in chat (lifecycle gaps, dispute gaps, admin gaps, white-screen findings, loader inventory, consistency issues). **No files changed.**

### Phase B — Batched implementation (only after you approve the Phase A report)
Each batch ships independently with build + typecheck verification.

- **B1 — White-screen + loader pass**: harden `ErrorBoundary`, fix any unguarded Suspense, replace inconsistent loaders with `LogoLoader` where appropriate (no flicker on fast paths).
- **B2 — Admin UI consistency**: tab spacing, card padding, grid alignment, typography rhythm across `AdminOverview/Operations/Revenue/Content/Engagement/System/Users/Disputes/Takedowns/Audit`. No redesign — only spacing/token alignment.
- **B3 — Admin capability gaps** (only the ones surfaced in Phase A that fit existing architecture): e.g. withdrawals view, milestone freeze action, dispute evidence viewer, audit trail filters. Extend existing components — no new dashboards.
- **B4 — Lifecycle gap fixes**: missing notifications, missing audit log entries, missing status transitions identified in Phase A. Minimal, surgical.
- **B5 — Dispute handling completeness**: only the missing pieces from Phase A (e.g. freeze milestone, pause payout, evidence upload UI if missing).

### Phase C — Verification
- `bun run build`, `tsgo`, `bunx vitest run`
- Playwright smoke against `/admin-dashboard`, `/artist-dashboard`, `/client-dashboard`, project detail, chat
- Console + network check on each dashboard route

## Why staged

Doing all 7 phases in one shot would touch 50+ files with no checkpoint — high risk of regression in payments, milestones, or auth. Phase A gives you a concrete gap list to approve/trim before any code moves.

## What I will NOT do
- No redesign, no design-system swap, no route restructure.
- No business-logic changes outside identified gaps.
- No new parallel admin surface — only extend `AdminDashboard` tabs.
- No removal of existing features.

## Open question
Approve this staged approach, or do you want me to **skip Phase A's written report and go straight to Phase B1 (white-screen + loaders)** since that's the most user-visible? Either is fine — staged is safer, direct is faster.
