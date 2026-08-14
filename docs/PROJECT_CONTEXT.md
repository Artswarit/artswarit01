# Artswarit — Project Context

**Purpose:** the shared source of truth for what this product is, how it is built, and which rules are load-bearing. Written from a full-codebase audit (2026-08-10); every claim here was verified against code, not assumed.

Companion docs: [FLOWS.md](FLOWS.md) (user journeys), [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) (what changed and what remains), [COMPREHENSIVE_AUDIT_2026-08.md](COMPREHENSIVE_AUDIT_2026-08.md) (full findings).

---

## 1. What the product is

An India-first artist marketplace with two sides:

- **Artists** publish a portfolio, sell individual artworks, offer services, and take on commissioned work.
- **Clients** browse/discover artists, buy artworks outright, and hire artists for **milestone-based projects funded through escrow**.

Revenue: a platform commission on transactions, waived for artists on a paid "Pro" subscription. There is also a separate per-artist `exclusive_memberships` feature (an artist-controlled access list for exclusive content) which is unrelated to the platform Pro subscription despite similar naming.

Two payment rails run in parallel: **Razorpay** (INR, primary for India, plus RazorpayX for artist payouts) and **Stripe** (USD). Which rail a user hits is driven by currency/region, not by a user choice.

---

## 2. Stack

| Layer | Technology |
|---|---|
| App | React 18, Vite 5, TypeScript 5, Tailwind 3, shadcn/ui (Radix) |
| Server state | `@tanstack/react-query` — configured well but adopted in only ~4 of ~37 data-fetching sites; the dominant pattern is hand-rolled `useState`+`useEffect`+direct Supabase calls |
| Backend | Supabase: Postgres + RLS, Auth, Storage, Deno Edge Functions |
| Realtime | Supabase Realtime (`postgres_changes` + presence channels) |
| Payments | Razorpay + RazorpayX (INR), Stripe (USD) |
| Analytics | PostHog |
| Testing | Vitest (unit), Playwright (E2E), Storybook/Chromatic (configured but see §7) |
| Hosting | Vercel (SPA rewrite), PWA via `vite-plugin-pwa` + Workbox |

---

## 3. Repository layout

```
src/
  components/
    ui/          shadcn/Radix primitives
    shared/      canonical primitives (EmptyState, PageHeader, FormField,
                 ConfirmDialog, RetryableError) — built, still 0 call sites
    dashboard/   artist + client dashboard surfaces (largest folder)
    admin/       admin console: finance, moderation, disputes, governance
    projects/    milestone/escrow workflow UI
    payments/    payment buttons and dialogs
    <feature>/   explore, artwork, artist-profile, client-profile, premium, ...
  pages/         route containers (some fetch their own data)
  hooks/         mix of reusable abstractions and page-specific fetchers
  contexts/      AuthContext (session+profile+subscription), CurrencyContext
  providers/     RealtimeProvider (app-wide presence)
  integrations/supabase/   client + generated types
  lib/           utilities, validation schemas, payments helpers, analytics
supabase/
  functions/     23 Deno edge functions
  functions/_shared/   posthog.ts, rateLimit.ts
  migrations/    72 SQL migrations — this is the schema of record
tests/e2e/       Playwright specs
docs/            audit + context docs
```

---

## 4. Identity and roles — read this before touching auth

There are **three** overlapping user representations. This is the single most important piece of context in the codebase:

| Table | Role column | Used for |
|---|---|---|
| `profiles` | `role` (text) | **The app's working role** — artist / client / premium. Read by `useProfile` → `useUserRole`. Half the schema FKs here. |
| `users` | `role` (`user_role` enum) | Legacy/parallel identity. The other half of the schema FKs here. |
| `user_roles` | `role` (`app_role` enum, includes `moderator`) | **Admin checks only**, via the `is_admin()` SECURITY DEFINER function. Read by `useIsAdmin`. |

Consequences you must respect:
- **Artist/client role comes from `profiles.role`. Admin status comes from `user_roles`.** Never conflate them.
- `is_admin()` is `SECURITY DEFINER`, so it does not recurse through RLS.
- Admin is a **single boolean** — there is no moderator/support tier in code, even though the `app_role` enum defines one.

---

## 5. Business rules that are load-bearing

These are enforced (or must be enforced) server-side. Breaking them causes money or trust bugs.

### Milestone escrow state machine
`LOCKED → WAITING_FUNDS → ACTIVE → REVIEW_PENDING → COMPLETED`, with `REVISION_REQUESTED` and `DISPUTED` branches. Enum: `milestone_status_v2`.

- **`COMPLETED` means "payout released."** It may only be set by `release-milestone-payout`. It is terminal — a completed milestone cannot be reopened.
- **`WAITING_FUNDS` / `LOCKED` are funding states** owned by the payment system, not by participants.
- Money columns (`amount`, `amount_paid`, `amount_usd`, `paid_at`, `payment_id`, `approved_at`) are **server-owned** and immutable to end users.
- Enforced by the `enforce_milestone_transition` trigger (migration `20260810120000`), which exempts service-role callers and admins.

Legal end-user transitions (mirroring the shipped UI):
`ACTIVE→REVIEW_PENDING`, `REVISION_REQUESTED→{ACTIVE, REVIEW_PENDING}`, `REVIEW_PENDING→REVISION_REQUESTED`, any non-terminal `→DISPUTED`, `DISPUTED→{ACTIVE, REVIEW_PENDING, REVISION_REQUESTED}`, and same→same no-ops.

### Payments
- **Never trust a client-supplied resource id on a payment verification call.** The artwork/milestone a payment applies to is derived server-side (from the Razorpay order's `notes`, or from the `payments` row keyed on `razorpay_order_id`).
- Webhook handlers must be idempotent — both Razorpay and Stripe deliver at-least-once.
- Dispute settlement may never disburse more than the escrowed amount, and must take an atomic lock before moving money.

### Subscriptions
- `subscribers` has **no `plan` column**. The tier lives in `subscription_tier` (`monthly` | `yearly` | `lifetime`). `email` is `NOT NULL`.
- Premium is active when: a `subscribers` row exists with `is_active = true` AND (`renew_at IS NULL` OR `renew_at > now()`). `renew_at IS NULL` means never-expiring.
- By existing convention, `stripe_customer_id` stores the **provider's subscription id** on both rails.

---

## 6. Architecture conventions

- **Data access lives in UI components** in many places (33+ files call Supabase directly). This is a known architectural weakness, not a pattern to copy. New work should prefer hooks.
- **Route-level code splitting** is in place via `React.lazy` for every page except the landing page.
- **`ErrorBoundary` in `App.tsx`** detects stale-chunk import failures after a deploy and force-reloads once — don't remove it.
- **Realtime channels must be cleaned up** in the `useEffect` return. All 79 current channels do this correctly; keep it that way.
- **Theming: use semantic tokens, not raw colours.** `bg-card` / `bg-background` / `text-foreground` / `text-muted-foreground` / `border-border` work in both themes. `--card` is pure white and `--background` is ~`#fafafa` in light mode, so switching a `bg-white` to `bg-card` changes nothing in light and fixes dark. Prefer this over adding `dark:` variants.
- **Shared glass classes** (`.glass-card`, `.glass-effect`, `.mobile-card` in `index.css`) set their own background. If a component using one looks wrong in a theme, fix the shared class — a background utility on the element will not reliably win.
- Genuinely light-only surfaces exist by design: video-player overlay chrome, the always-dark `Footer`, and white CTA buttons on coloured heroes. Don't "fix" these.
- **`src/integrations/supabase/types.ts` is generated.** It has drifted from the real schema before (e.g. missing `disputes.previous_status`, missing `artist_services` currency columns, `project_milestones.status` typed as bare `string`). Regenerate rather than hand-edit where possible.
- Two test harnesses exist: `src/test/` (Vitest, `test:unit`) and `src/tests/` (a hand-rolled runner that `npm test` actually invokes). Prefer Vitest.

---

## 7. Known infrastructure gaps

- **CI does not run lint, typecheck, or unit tests** — only Playwright and Chromatic.
- **Storybook is broken**: `package.json` mixes Storybook v8 addons with v10 core, so `npm ci` fails on peer resolution and `build-storybook` cannot succeed. There is also no `.storybook/` config and no `*.stories.*` files. Install currently requires `--legacy-peer-deps`.
- **No error monitoring** (no Sentry or equivalent). Errors reach `console.error` and PostHog's incidental exception capture only.
- **No test coverage** for escrow, disputes, auth, or admin flows.

---

## 8. Environment

Client (`VITE_*`, safe to ship in the bundle): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`.

Server-only (Supabase Edge Function secrets — never `VITE_`): `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID/SECRET`, `RAZORPAYX_*`, `STRIPE_SECRET_KEY`, `GOOGLE_GEMINI_API_KEY`, `GROQ_API_KEY`, and other AI provider keys.

Audited: no secrets are committed, `.gitignore` covers `.env*`, and no server-only secret is exposed via a `VITE_` variable.
