
# Artswarit Platform — Fix & Upgrade Plan

This is a large multi-area request. I'll group it into 6 phases. Each phase is independently shippable and won't break existing functionality. I'll implement them in order, in this single thread, unless you want to drop or reorder anything.

---

## Phase 1 — Navigation & Performance (no more "loading on every route")

**Diagnosis I'll run first:** route-level `LogoLoader` is currently rendered as Suspense fallback for every `React.lazy` route, so any cache-miss chunk re-shows the splash. Combined with `AuthContext` re-firing on visibility changes and several dashboards calling `setLoading(true)` on every tab switch, this produces the constant loading flash.

**Fixes:**
- Replace global Suspense fallback with a thin `TopLoadingBar` (already exists) + keep previous route painted (no full splash on navigation).
- Add a shared React Query `staleTime` (e.g. 60s) + `keepPreviousData` so tab switches use cache, not a spinner.
- Convert dashboard tab loads to "show cached data, refresh in background" pattern (no `setLoading(true)` when data already present).
- Scope realtime subscriptions to only: notifications, messages, project status, milestone updates. Remove redundant `useRealtimeSync('notifications', …)` duplicates in `ArtistNotifications`.
- Prefetch lazy chunks on hover/visible (link prefetch) so transitions feel instant.

## Phase 2 — Intro / Splash Animation

- Restore `AppSplashScreen` as a true intro: shows only on first app open (PWA launch or fresh tab), gated by `sessionStorage` so it doesn't reappear on internal navigation.
- Mount it before React hydrates via the existing `index.html` boot loader (CSS-only logo + name fade-in already partly there) and hand off to React when ready.
- Skip on Lovable preview iframes.

## Phase 3 — Project Detail Page sidebar overlap

- Only structural fix, no UI change: convert sticky sidebar container to `position: sticky; top: <header>; align-self: start; max-height: calc(100dvh - <header>); overflow-y: auto;` inside a CSS grid (`grid-cols-[1fr_320px]`).
- Remove the `z-index` that currently lets it paint over the bottom tab strip.
- Apply `pb-safe` so the bottom tab bar (TIMELINE/VAULT/CHAT) doesn't clip the last card on mobile.
- Verify with Playwright at 759×676 (the viewport in your screenshot) and at 1440×900.

## Phase 4 — Artist Dashboard

**a) Premium button**
- Audit every "Premium" / "Upgrade" CTA. Route all of them through a single `useUpgradeToPro()` helper that navigates to `/artist-dashboard?tab=membership` (new dedicated tab) or opens `PremiumMembership` consistently.

**b) Overview reorg** (no info removed, no visual redesign)
New order:
1. Greeting + Pro status banner
2. KPI row: Earnings (month) · Pending Payouts · Active Projects · Profile Views
3. Action row: Active Projects list + Pending Milestones
4. Engagement: Recent Likes / Saves / Follows
5. Insights teaser (locked for free users → links to Analytics tab)
6. Quick links / shortcuts

**c) Settings**
- Remove `Membership` sub-tab from Settings.
- Add `Membership` as a top-level Artist Dashboard tab using existing `PremiumMembership` component.

**d) Dashboard nav reorg**
Proposed top-level order: Overview · Projects · Artworks · Messages · Analytics · Earnings · Membership · Notifications · Settings.
Audit each tab; remove dead/duplicate buttons; verify every redirect.

## Phase 5 — Advanced Analytics (Pro only) + Locked Premium Features

**Analytics tab** (Pro-only, locked preview for free):
Pull from PostHog Query API via a new edge function `artist-analytics` (server-side, uses `POSTHOG_KEY` already configured for capture — needs a `POSTHOG_PERSONAL_API_KEY` secret for read access; I'll ask before adding).
Metrics: profile views, portfolio views, artwork views, likes, saves, shares, contact clicks, inquiry clicks, project invites, proposal acceptance rate, profile→contact conversion, visitor geo, traffic source, new vs returning, device, search appearances, portfolio-over-time, top artworks, engagement trends.

**Locked feature pattern:**
- New `<LockedFeature feature="csv_export | pdf_report | advanced_analytics">` wrapper showing blurred preview + "Upgrade to Pro" CTA, driven by `useArtistPlan()`.
- Apply to CSV Export, PDF Report, Advanced Analytics, Premium Reports.
- Verify PDF generation (jsPDF) works after unlock.

## Phase 6 — Notification System (Artist + Client)

**UI/UX**
- Unified notification center page + bell dropdown:
  - Real-time (already wired) · read/unread states · mark one/all read · search · filters · categories (Projects, Payments, Messages, Reviews, System, Membership) · infinite scroll · preferences page (email/in-app/push per category).

**Retention policy (DB migration)**
```text
- read notifications  > 30 days  → delete
- unread              > 90 days  → archive (is_archived=true)
- archived            > 180 days → delete
```
Implemented via:
- `is_archived boolean default false` column on `notifications`.
- `archived_at`, `expires_at` columns.
- `cleanup_old_notifications()` SQL function.
- pg_cron job nightly at 03:00 UTC.
- Index on `(user_id, is_read, created_at)` to keep cleanup + queries fast.

## Phase 7 — Verification

For each phase I'll Playwright-test the affected flows at mobile + desktop, screenshot, and confirm no regressions before moving to the next.

---

### Questions before I start

1. **PostHog read access** — Phase 5 needs a `POSTHOG_PERSONAL_API_KEY` secret to query analytics server-side. OK to add? (Alternative: derive analytics from our own Supabase event tables — slower to build, no extra secret.)
2. **Notification retention numbers** — OK with 30 / 90 / 180 day windows above, or different?
3. **Scope** — implement all 6 phases sequentially in this thread, or ship phase-by-phase with your review between each?

Once you confirm, I'll start with Phase 1 (the most impactful for daily UX).
