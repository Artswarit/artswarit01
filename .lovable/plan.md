# Artswarit — Full Product & UX Audit

Read-only audit. No code is modified. Findings are grouped by deliverable, each item tagged `[Severity] Location — Problem → Suggested fix (Effort • Impact)`.

Effort: S = <30 min, M = ½–1 day, L = multi-day. Impact: UX / Conv / Maint.

---

## 1. Executive Summary

The app is feature-rich (artist + client + admin dashboards, projects, milestones, chat, payments, premium, disputes) but suffers from **organic growth debt**: multiple parallel patterns for the same primitive (button sizes, card paddings, modal heights, empty states), heavy per-page custom layout instead of design-system reuse, and inconsistent feedback (toasts vs inline vs silent). Visually the "Apple-like" intent is mostly delivered in chat + navbar, but breaks down in dashboards, settings, and forms.

Top themes:

1. **Design-system drift** — `font-black`, hardcoded `text-blue-600`, `bg-white/80`, custom `rounded-[2rem]` vs token `rounded-lg`. Tokens exist but are bypassed.
2. **Dashboard information architecture** — too many tabs, duplicated headers, inconsistent safe-area + sticky behavior across artist vs client.
3. **Feedback gaps** — many mutations have no optimistic UI; some have noisy toasts, others silent failures (load projects suppressed).
4. **Forms** — inconsistent label/required/error patterns; password rules only on signup; missing inline async validation.
5. **Accessibility** — icon-only buttons missing `aria-label`, color-only states, focus rings inconsistent on custom buttons.
6. **Mobile** — overall safe-area handling is good now, but modal/sheet height math and tab bars still produce edge cases in Project Detail, Create Project, and Settings.

Estimated effort to address Critical + High items: ~5–7 focused engineering days. ROI: meaningfully higher activation, fewer support tickets on chat/project flows, faster future feature work due to primitive consolidation.

---

## 2. Critical UX Issues

- **[Critical] Project Detail modal on mobile** — Tabs (Overview / Milestones / Communication / Vault) all render in one tall modal; tab content jumps to bottom on open and header occasionally hides composer on small phones. → Convert to a route-based full-screen page on mobile (`/projects/:id`) with a real back button; keep modal only on desktop. (L • UX+Conv)
- **[Critical] Chat conversation switch on mobile** — Selecting a conversation enters a `fixed inset-0 z-[120]` overlay but back gesture sometimes leaves the bottom tab bar visible briefly; no swipe-back; "Load older messages" button competes with header. → Use a dedicated `/messages/:threadId` route with native back, sticky composer using `dvh`, and an inline "Load older" anchor that auto-fires on scroll-top. (M • UX)
- **[Critical] Create Project flow** — Single long form, no step indicator, no draft autosave, validation only on submit, mobile keyboard hides submit. → Wizard (Brief → Budget/Deadline → Attachments → Review), autosave to local + Supabase draft, sticky CTA. (L • Conv)
- **[Critical] Onboarding/Profile completion** — Banner appears on every dashboard load until `full_name` + `bio` set; no in-context guided wizard from banner; "complete profile" link drops user into Settings without highlighting missing fields. → Inline 3-step wizard sheet anchored to banner CTA. (M • Activation)
- **[Critical] Payments flow ambiguity** — Razorpay vs Stripe routed by currency, but users see no explicit "you will be charged in INR/USD" line before checkout; refund/dispute path not surfaced near pay button. → Pre-checkout summary card with FX line + dispute policy link. (M • Trust+Conv)
- **[High] Logout** — Triggered from avatar dropdown with no confirmation; accidental taps on mobile common. → Add lightweight confirm only on mobile; keep desktop one-click. (S • UX)
- **[High] Notifications page vs bell** — Two surfaces with subtly different grouping/read-state logic; users mark read in one, other still shows badge until refresh. → Single source via realtime invalidation. (M • UX+Maint)

---

## 3. Critical UI Issues

- **[Critical] Navbar typography weight** — `font-black` everywhere (menu items, dropdown items, buttons) clashes with body `Inter` and feels heavy vs Apple intent. → Move to `font-semibold` (600) for nav, reserve `font-black` for hero headings. (S • UX)
- **[Critical] Mixed brand color usage** — Navbar login/signup hardcode `text-blue-600 / bg-blue-600`, but rest of app uses `--primary` (`#7C4DFF` purple in Tailwind extend). Two brand colors visible simultaneously. → Replace with `variant="ghost"` + `variant="default"` tokens. (S • Brand)
- **[Critical] Border radius scale collision** — `rounded-xl`, `rounded-2xl`, `rounded-[2rem]`, `rounded-md`, `rounded-full` used interchangeably for the same role (buttons in navbar use `rounded-md`, buttons elsewhere `rounded-xl`). → Lock 3 tiers: `sm` inputs/badges, `lg` buttons/cards, `2xl` modals/sheets. (M • Consistency)
- **[High] Shadow inconsistency** — `shadow-sm`, `shadow-lg shadow-primary/20`, `shadow-2xl`, plus arbitrary `shadow-[...]` in chat. → Define `--shadow-elevated`, `--shadow-overlay`, `--shadow-floating` tokens. (M)
- **[High] Icon size drift** — `h-4 w-4`, `size-5`, `h-6 w-6`, `size={18}` mixed. → Standardize: 16 (inline), 20 (buttons), 24 (nav/headers). (S)
- **[High] Avatar shapes** — Navbar uses `rounded-xl` avatars, profile + chat use `rounded-full`. → Pick circle globally, square only in admin tables. (S)
- **[Medium] Skeleton variety** — Shimmer skeleton coexists with spinner + "Loading..." text + blank flashes. → One pattern per surface type (list = skeleton, action = spinner-in-button, page = top loading bar). (M)

---

## 4. Design System Violations

- Hardcoded colors: `text-blue-600`, `bg-emerald-500`, `text-red-500`, `bg-black/20`, `bg-white/80` across Navbar, dashboards, badges.
- Hardcoded sizes: `h-[2rem]`, `pt-[calc(4.75rem+var(--safe-top))]` repeated; should be a layout component prop.
- `font-heading` (Poppins) declared in Tailwind but rarely applied; headings inherit Inter — defeats the heading scale.
- `artswarit.purple` token exists in tailwind config but components reference `--primary` HSL — two parallel brand color systems.
- Missing tokens: spacing scale uses raw `gap-2/3/4/6/8`; no semantic `space-section`, `space-card`.
- Button has `loading` prop but several call-sites still implement local `isSubmitting && <Loader2 />`.
- `Dialog` and `Sheet` both used for the same role (Create Project uses Sheet on mobile, Dialog on desktop, but Settings uses Dialog on both).

→ Action: produce `DESIGN_TOKENS.md` and a one-pass migration to remove hardcoded color/radius classes; add ESLint rule banning `text-(white|black|gray-\d+|blue-\d+|...)` outside `index.css`.

---

## 5. Component Improvements

Duplicate / overlapping:

- `MessagingModule`, `ProjectDetailModal` chat tab, `MessageArtistDialog`, `MessageClientDialog`, `ChatMessages` (explore) — 5 chat surfaces, 3 different bubble implementations. → Extract `<ChatThread>` + `<ChatComposer>` primitives.
- `ArtistCard` (explore), `FeaturedArtistCard`, `ChatbotArtistCard` — 3 variants of same entity card. → One `<ArtistCard variant="featured|compact|chat">`.
- `ArtworkCard` vs `ArtworkCardModern` — drop the older one.
- `ProfileCompletionBanner` + `ProfileCompletionWizard` + `DashboardAttentionRequired` — overlapping nudge surfaces.

Missing primitives:

- `<EmptyState icon title description action>` — every page rolls its own.
- `<PageHeader title subtitle actions breadcrumbs>` — dashboards each implement custom headers.
- `<StatCard>` exists in artist-profile only; client + admin reimplement.
- `<FormField>` wrapper for label+input+error+hint.
- `<ConfirmDialog>` — destructive actions reimplement Dialog.

Over-complex components:

- `ArtistDashboard.tsx` and `ClientDashboard.tsx` are routers + state + tabs + data fetchers in one file. → Split into `*DashboardShell` + per-tab modules with their own queries.

---

## 6. UX Flow Improvements

- **Signup** — Role chosen via URL param; users landing on `/signup` directly with no role get a default; not obvious. → Visible role toggle at top of form.
- **Login** — Forgot-password link small + low contrast; no "magic link" option despite Supabase support. → Promote forgot link; add magic link as secondary.
- **Onboarding** — No guided tour. New artists land on full dashboard. → 3-card welcome overlay first visit only.
- **Settings** — Single long page with many sections; no anchor nav, no save-on-blur (must scroll to bottom Save). → Section-level Save with inline confirmation.
- **Billing/Subscription** — Plan comparison + payment + invoices spread across three components. → Unified `/billing` route.
- **Checkout** — No order summary persistence on failure; user must restart. → Persist intent + show "Retry payment" CTA.
- **Upload (Artwork)** — No drag-drop on desktop, no progress per file, no resume. → Add chunked upload with progress.
- **Chat** — Cannot search in conversation, cannot delete/edit messages, no read receipts UI even though state likely exists. → Surface receipts; add long-press menu.
- **Search** — Global search absent in Navbar despite Search icon page; users must navigate to Explore first. → Add cmd-k global search.
- **Notifications** — No grouping, no filter by type, no "mark all read" on mobile.
- **Logout** — See §2.

---

## 7. Logical Flow Issues

- **Double-submit** — `SignupForm` now uses `Button loading`, but Create Project, MilestoneSubmissionDialog, ReviewDialog still allow rapid double-click before request resolves.
- **Race conditions** — `useRealtimeMessages` was recently fixed; verify similar pattern in `useUnreadMessagesCount` (channel may rebind on each notification).
- **Invalid states reachable** — Pay milestone button visible even when previous milestone not approved on some legacy projects; client-side check, but no server guard surfaced in UI.
- **Reversibility** — Artwork delete is permanent, no undo / trash. Project cancellation likewise final.
- **Permissions** — Some Edit buttons render then 403 on click (artist viewing another artist's project link). → Hide via role check.
- **Loading** — `ProjectManagement` swallowed error toast; users see infinite skeleton if RLS denies. → Show inline empty + retry.
- **Success flows** — Milestone payment success goes to toast then stays on same screen; user has to manually go to project to see new status. → Auto-route + highlight new milestone.

---

## 8. Accessibility Findings

- **[High]** Icon-only buttons missing `aria-label`: notification bell, message badge, mobile menu burger uses div bars (not announced), avatar trigger.
- **[High]** Color-only state: unread message dot, online presence dot, milestone status pills (color without text on some).
- **[High]** Focus visibility: custom `rounded-2xl` buttons lose ring; shadcn default ring overridden in some variants.
- **[Medium]** Heading order: dashboards jump from `h1` (page) to `h3` (cards), skipping h2.
- **[Medium]** Form labels: several inputs use placeholder as label (signup name, search bar).
- **[Medium]** Modal close: Sheet overlay close on mobile sometimes traps focus when chat overlay opens above.
- **[Medium]** Live regions: toast announcements OK (sonner), but inline form errors not in `aria-live`.
- **[Low]** `lang` attribute on `<html>` — verify set to `en` in `index.html`.
- **[Low]** Contrast: `text-muted-foreground/50`, `text-muted-foreground/70` used on light bg — likely <4.5:1.

---

## 9. Responsive Issues

Desktop:

- Dashboards max-width never capped — content stretches edge-to-edge on 1920+ making line lengths >120ch in chat and notifications.
- Project Detail modal grows tall; vault tab table overflows horizontally without scroll affordance.

Tablet (768–1024):

- Navbar collapses to mobile mode at `<lg` (1024), losing nav links in a useful range. → Show a condensed desktop nav at `md`.
- Dashboard mobile bottom tabs persist on tablet portrait → wastes vertical space.

Mobile:

- Create Project sheet header overlaps first input when keyboard opens iOS Safari.
- Long artist names wrap to 3 lines in cards, breaking grid rhythm.
- Tables in admin + billing scroll the whole page instead of the table.
- Some buttons <44px (icon-sm in dropdowns).

---

## 10. Product Recommendations

1. **Consolidate chat into one primitive + a route** — biggest UX and code-debt win.
2. **Adopt a real onboarding** for both roles (separate flows: artist verification vs client first-project).
3. **Introduce Inbox concept** — unify messages + notifications + project events.
4. **Add Drafts + Autosave** across Create Project, Artwork Upload, Profile edit.
5. **Add Activity Feed on dashboards** instead of repeated "Recent X" widgets.
6. **Trust signals**: verified badges, response time, completion rate already partly stored — surface uniformly.
7. **Pricing transparency**: pre-payment FX + fee breakdown.
8. **Search**: global cmd-k + saved searches.
9. **Empty states with CTAs** everywhere ("No projects yet — Create your first brief").
10. **Analytics-grade dashboard**: replace dense numeric tiles with sparkline + delta + period selector.

---

## 11. Screens Requiring Redesign (not just polish)

- Project Detail (especially mobile) — full route, not modal.
- Settings (artist + client) — section nav + per-section save.
- Notifications page — grouping + filters.
- Admin Dispute Settlement — currently dense form; needs guided steps.
- Billing/Subscription — unify three screens.
- Onboarding (new screen) — does not exist as a flow today.

---

## 12. Quick Wins (<30 min each)

- Replace `font-black` in Navbar/menus with `font-semibold`. (S • UX)
- Replace hardcoded `text-blue-600/bg-blue-600` in Navbar with `variant` tokens. (S • Brand)
- Add `aria-label` to Notification bell, Message badge, avatar trigger, mobile burger. (S • A11y)
- Standardize icon sizes in dashboard headers to `h-5 w-5`. (S • Consistency)
- Make all "Load more" buttons use the same shared component. (S)
- Add `aria-live="polite"` wrapper around inline form errors. (S • A11y)
- Cap dashboard content with `max-w-7xl mx-auto`. (S • UX)
- Add confirm on mobile logout. (S • UX)
- Hide bottom dashboard tabs on tablet+. (S • UX)
- Replace placeholder-as-label inputs with proper `<Label>`. (S • A11y)

---

## 13. Medium Improvements (½–1 day)

- Extract `<EmptyState>`, `<PageHeader>`, `<FormField>`, `<ConfirmDialog>` primitives and migrate top 10 usages.
- Unify ArtistCard variants.
- Consolidate shadow + radius tokens; codemod replace.
- Notifications dedupe with bell (single hook + invalidation).
- Settings section-level save.
- Pre-checkout payment summary card.
- Drag-drop artwork upload with progress.
- Tablet navbar breakpoint fix.
- Inline retry on failed project load.

---

## 14. High-Impact Improvements (multi-day)

- Route-based Project Detail + Chat (replaces nested modals).
- Onboarding wizards for artist + client.
- Unified Inbox (messages + notifications + project events).
- Create Project wizard with autosave.
- Cmd-K global search.
- Full design-system migration + ESLint guardrail against ad-hoc colors.
- Dashboard redesign with period-aware widgets.

---

## 15. Future Product Opportunities

- Artist analytics: traffic, conversion from view→message→hire.
- Client CRM: shortlist artists, saved briefs, repeat-hire flow.
- Templated commissions / packages (fixed-scope, fixed-price).
- AI-assisted brief writer for clients (already have AI gateway).
- AI moderation of artwork uploads (already partially present).
- Subscription tiers tied to discoverability boost.
- In-app video calls for commission kickoffs.
- Referral program with milestone-based rewards.
- Public artist portfolio export (PDF/site).
  &nbsp;

---

## How to use this report

Tell me which sections to act on. I will then:

1. Re-enter build mode only on approval,
2. Open a focused PR per theme (Quick Wins → Tokens → Primitives → Flows),
3. Add visual regression coverage (Chromatic already wired) per change.

No code has been modified by this audit.