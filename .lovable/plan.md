
## Goal

Replace the current tabbed admin console with the uploaded design: a fixed left sidebar + top search bar + a dense KPI grid, charts, recent activity feed, and platform health panel. Every number, list, and status is powered by real Supabase data and updates in realtime — no mocked values.

## New layout

```text
┌─────────────┬────────────────────────────────────────────────────┐
│  Artswarit  │  🔍 Search users/projects/txns   🟢 systems  🔔 AK │
│             ├────────────────────────────────────────────────────┤
│ Dashboard ● │  Dashboard                                         │
│ Users       │  Here's what's happening across Artswarit today.   │
│ Projects    │  ┌──────┬──────┬──────┬──────┬──────┐              │
│ Escrow      │  │ KPI  │ KPI  │ KPI  │ KPI  │ KPI  │ (11 cards)   │
│ Disputes  4 │  ├──────┴──────┴──────┴──────┴──────┤              │
│ Withdrawals │  │ Revenue trend        │ Escrow vol │              │
│ Portfolio   │  ├──────────┬───────────┴────────────┤              │
│ Payments    │  │ Users    │ Subs    │ Top categories             │
│ Analytics   │  ├──────────┴───────────┬────────────┤              │
│ Settings    │  │ Recent activity      │ Platform health          │
│             │  └──────────────────────┴────────────┘              │
│ ‹ Collapse  │                                                    │
└─────────────┴────────────────────────────────────────────────────┘
```

Mobile: sidebar collapses into a bottom sheet / hamburger; KPI grid stacks 2-cols; charts stack single column.

## Sidebar sections → existing data

| Section        | Data source                                                          | Realtime  |
| -------------- | -------------------------------------------------------------------- | --------- |
| Dashboard      | Aggregated KPIs (below)                                              | yes       |
| Users          | `UserGovernance` (existing component, restyled shell)                | yes       |
| Projects       | `AdminOperations` (projects + milestones breakdown)                  | yes       |
| Escrow         | `payments` where status in (`held`, `escrow`), `AdminFinance` subset | yes       |
| Disputes       | `DisputeSettlement` (existing)                                       | yes       |
| Withdrawals    | `withdrawals` table (pending / paid / failed)                        | yes       |
| Portfolio      | `ContentModeration` (artworks pending / reported)                    | yes       |
| Payments       | `AdminRevenue` (payments + fees)                                     | yes       |
| Analytics      | `AdminEngagement` + `AdminSystem` (engagement + system health)       | yes       |
| Settings       | Simple stub (theme, admin profile) — no new backend                  | —         |

Existing tab bar is removed; each sidebar item mounts one of the current components inside the new shell so no business logic is lost.

## Dashboard KPI cards (all live)

1. **Platform revenue** — sum(`payments.platform_fee`) MTD, +% vs previous month
2. **Gross marketplace value** — sum(`payments.amount`) where status succeeded, MTD
3. **Escrow balance** — sum(`project_milestones.amount`) where status = `funded`/`in_progress`
4. **Active projects** — `projects` where status in (`in_progress`, `pending`)
5. **Active artists** — `profiles` where role in (`artist`, `premium`) and `last_active_at` ≥ 30d
6. **Active clients** — `profiles` where role = `client` and `last_active_at` ≥ 30d
7. **Pending withdrawals** — sum + count from `withdrawals` where status = `pending`
8. **Pending disputes** — count `disputes` where status = `open`; urgent = open > 48h
9. **Portfolio reviews** — count `artworks` where status = `private` (awaiting approval)
10. **Pro subscribers** — count `subscribers` where `is_active` and `subscription_tier` = pro
11. **Platform health** — uptime derived from `function_logs` success ratio last 24h

All numbers currency-formatted with the existing `useCurrencyFormat` hook (₹ shown to match design; user's currency preference respected).

## Charts

- **Revenue trend** (line, 12 months) — monthly sum of `payments.platform_fee`
- **Escrow volume** (grouped bars) — held vs released per month from `payments` + `project_milestones`
- **User growth** (line) — weekly signup count from `profiles.created_at` (reuses `useSignupTrend`)
- **Subscription growth** (line) — monthly count of active `subscribers`
- **Top categories** (horizontal bars) — sum of `payments.amount` grouped by artwork category

Recharts (already installed) for all charts. Skeletons while loading.

## Recent activity feed

Union of:
- `admin_audit_logs` (existing)
- `disputes` opened
- `withdrawals` requested
- `milestone_submissions` created
- `artworks` flagged / reported

Ordered by created_at, top 8, live via a single realtime channel subscribing to those tables.

## Platform health panel

- Razorpay — ping `function_logs` for `verify-razorpay-payment` success rate 24h
- Supabase DB — `postgres_logs` error count (via edge fn) or fallback ok
- AI moderation — `function_logs` for `report-content`
- Storage — heartbeat via a tiny signed-url probe (client-side)
- Email delivery — `function_logs` for `send-*` (degraded if fail-rate > 5%)

Each row: green/amber/red dot + label + status text.

## Realtime strategy

One shared realtime provider hook `useAdminRealtime()` subscribes to: `payments`, `withdrawals`, `disputes`, `projects`, `subscribers`, `artworks`, `admin_audit_logs`. On any event it invalidates the relevant react-query keys — cards, charts and activity feed refresh without polling. Cleanup on unmount.

## Files

New:
- `src/components/admin/shell/AdminShell.tsx` — sidebar + top bar layout
- `src/components/admin/shell/AdminSidebar.tsx`
- `src/components/admin/shell/AdminTopBar.tsx` (search, systems pill, notif, avatar)
- `src/components/admin/overview/OverviewKpis.tsx` (11-card grid)
- `src/components/admin/overview/RevenueTrendChart.tsx`
- `src/components/admin/overview/EscrowVolumeChart.tsx`
- `src/components/admin/overview/UserGrowthChart.tsx`
- `src/components/admin/overview/SubscriptionGrowthChart.tsx`
- `src/components/admin/overview/TopCategoriesChart.tsx`
- `src/components/admin/overview/RecentActivityFeed.tsx`
- `src/components/admin/overview/PlatformHealthPanel.tsx`
- `src/components/admin/hooks/useAdminOverview.ts` (all overview queries)
- `src/components/admin/hooks/useAdminRealtime.ts`

Rewritten:
- `src/components/admin/AdminDashboard.tsx` — thin router that renders `<AdminShell><section/></AdminShell>` based on active sidebar section (state, not URL — keeps existing route working).

Unchanged (reused inside the shell):
- `UserGovernance`, `DisputeSettlement`, `ContentModeration`, `AuditLog`, `AdminRevenue`, `AdminOperations`, `AdminFinance`, `AdminEngagement`, `AdminSystem`, `AdminContent`.

No DB migrations required — every query hits existing tables.

## Design tokens

Match uploaded design:
- Sidebar bg `hsl(var(--card))`, 256px wide, collapsible to 64px
- Active nav item: light violet fill `hsl(var(--primary)/0.08)` + primary text
- KPI cards: white/card, 1px border, soft shadow, `p-5 rounded-2xl`
- Numbers: `text-3xl font-semibold tracking-tight`
- Positive delta: emerald-500; negative: rose-500
- Charts: primary violet + secondary lavender fills, no gridlines, minimal axes

All colors via existing semantic tokens — no hex in components.

## Out of scope (ask before adding)

- Global command palette (⌘K) — visual only in v1; behaviour later
- "+" quick-create menu — visual only in v1
- Notifications bell dropdown — links to existing `/notifications`
