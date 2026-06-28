## Gap Analysis — Current Admin Dashboard

**What exists today** (`src/components/admin/`):
- `AdminOverview` — 4 KPI cards (users, artists, artworks, open disputes) + 1 placeholder bar chart (hardcoded J/F/M/A data) + escrow summary + a "Live Audit Feed" that just reuses recent signup timestamps with a fake label.
- `UserGovernance` — user list + warnings/suspension actions.
- `DisputeSettlement` — dispute resolution.
- `ContentModeration` — reports / takedowns.
- `AuditLog` — admin_audit_logs viewer.

**What's missing despite the data already existing in Supabase:**

| Area | Tables already in DB | Currently surfaced? |
|---|---|---|
| Growth (users/artists/clients over time) | `profiles.created_at` | ❌ chart is fake |
| Artwork pipeline (pending review, AI-flagged, top viewed/liked) | `artworks`, `artwork_views`, `artwork_likes`, `saved_artworks` | ❌ |
| Project lifecycle (created/accepted/in-progress/completed/cancelled, avg completion, stuck) | `projects`, `project_activity_logs` | ❌ |
| Milestones (pending/approved/rejected/overdue, auto-approval queue) | `project_milestones`, `milestone_submissions`, `milestone_revisions` | ❌ |
| Revenue & payments (success/failed/pending, refunds, withdrawals, GMV, escrow balance) | `payments`, `transactions`, `withdrawals`, `sales`, `razorpay_payments` | ❌ |
| Messaging health (conversations, messages/day, unanswered) | `conversations`, `messages` | ❌ |
| Notifications (sent volume, type breakdown, unread rate) | `notifications` | ❌ |
| Engagement (DAU/WAU, follows, saves, comments, recently-viewed) | `login_sessions`, `follows`, `comments`, `recently_viewed` | ❌ |
| Reports & moderation queue depth | `reports`, `user_warnings`, `user_blocks` | partial (Moderation tab) — no KPIs |
| Subscriptions / Pro tier | `subscriptions`, `subscribers`, `exclusive_memberships` | ❌ |
| Auth security (failed logins, suspicious sessions) | `login_sessions` | ❌ |
| Edge function health | `function_logs`, `webhook_logs` | ❌ |
| Live Audit Feed | `admin_audit_logs` exists | ❌ feed shows fake text |

PostHog is connected but not surfaced in-product — funnels/retention/errors will come from PostHog via the existing `mcp_posthog` integration as a follow-up; for this batch every widget is backed by Supabase tables that already exist.

## Implementation Plan (single batch, reuses existing design system)

No new pages, no redesign. Only additions inside `src/components/admin/AdminDashboard.tsx`. All new modules use existing `Card`, `Tabs`, `Table`, `Badge`, `recharts` components and the same rounded/spacing tokens already in the admin shell.

### 1. Fix `AdminOverview` (replace fake data, keep layout)
- Replace hardcoded `[{J:40},{F:30}...]` bar chart with a **real 12-week signup trend** from `profiles.created_at` (split: artists vs clients line chart).
- Replace fake "Live Audit Feed" with the real last 8 rows from `admin_audit_logs` (action + actor + target + timestamp). Falls back gracefully if empty.
- Add 4 secondary KPIs under the main grid: **Active 24h**, **Pending Reviews** (`artworks.approval_status='pending'`), **Open Reports** (`reports.status='pending'`), **Failed Payments 7d** (`payments.status='failed'`).

### 2. New tab: **Operations** (`AdminOperations.tsx`)
Replaces the need for separate Projects/Milestones tabs by grouping lifecycle health:
- Projects funnel donut: created → accepted → in_progress → completed → cancelled (from `projects.status`).
- Milestones status bar: pending / submitted / approved / rejected / disputed (from `project_milestones.status`).
- "Stuck projects" table: `projects` with `status='in_progress'` and no `project_activity_logs` row in 14d.
- Avg project completion time (created_at → completed_at).

### 3. New tab: **Revenue** (`AdminRevenue.tsx`)
- KPI row: GMV (sum `payments.amount` succeeded), Net Revenue (platform fee), Pending Escrow, Refunds, Withdrawals pending/paid.
- 30-day daily revenue area chart (`payments` grouped by day, status='succeeded').
- Failed-payment table (last 20 with reason, gateway, user).
- Top-earning artists table (top 10 by sum of payouts).

### 4. New tab: **Content** (`AdminContent.tsx`)
- KPIs: Uploads today, Pending review, AI-flagged (`artworks.metadata->>'ai_flagged'`), Reported.
- Top 10 most-viewed / most-liked / most-saved artworks (joins `artwork_views`, `artwork_likes`, `saved_artworks`).
- Category distribution bar chart from `artworks.tags`.
- Quick-action: open in `ContentModeration` for any row.

### 5. New tab: **Engagement** (`AdminEngagement.tsx`)
- DAU / WAU / MAU computed from `login_sessions.created_at` (distinct user_id per window).
- Messaging health: conversations, messages last 7d, unanswered conversations (no message in 48h after last client msg).
- Notification volume + by type (7-day stacked bar from `notifications`).
- Top followed artists (from `follows`).

### 6. New tab: **System Health** (`AdminSystem.tsx`)
- Edge function success/failure rate from `function_logs` (last 24h, group by function_name, status).
- Webhook delivery status from `webhook_logs`.
- Auth security: failed login count (24h), distinct IPs, suspicious sessions from `login_sessions` (multiple IPs same user in 1h).
- Subscriptions snapshot: active / cancelled / past_due from `subscriptions`.

### 7. Shared filter bar (top of each new tab)
Date range (7d / 30d / 90d / custom) + role filter (artist/client) where applicable. One small `<AdminFilters />` component reused across the 5 new tabs.

### Files added
```text
src/components/admin/
  AdminOperations.tsx
  AdminRevenue.tsx
  AdminContent.tsx
  AdminEngagement.tsx
  AdminSystem.tsx
  AdminFilters.tsx
  hooks/useAdminMetrics.ts   ← shared queries with React Query caching
```

### Files modified
- `src/components/admin/AdminDashboard.tsx` — add 5 new `TabsTrigger` + `TabsContent` entries (existing tab styling reused verbatim, no visual changes to the shell or the 5 existing tabs).
- `src/components/admin/AdminOverview.tsx` — replace fake chart + fake audit feed with real queries; add 4 secondary KPIs.

### Out of scope (deferred, called out)
- PostHog-driven funnels/retention/errors/Web Vitals — needs PostHog tools wired into the dashboard; will be a separate batch once we confirm which events are actually being captured.
- The 21 open Supabase security findings shown in the side panel — separate concern, will tackle in a dedicated migration after this UI batch (privilege-escalation in `user_roles`, `project_milestones` RLS disabled, public-read on `profiles`/`users`, milestone-submissions storage policy, etc.).
- No changes to existing dispute / moderation / audit / user-governance modules — they already work.

### Verification
- Typecheck + lint after the batch.
- Manual smoke: load each new tab with the artist test account promoted to admin; confirm queries return without RLS errors and no console noise.

Approve and I'll implement all 7 file changes in one pass.