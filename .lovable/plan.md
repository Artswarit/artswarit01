# Production-Readiness Audit & Safe Fixes

A 5-phase audit. Each phase ends with a written report section and a verified build (lint + typecheck + existing tests). UI, UX, layouts, colors, typography, spacing, animations, business logic, APIs, and DB schema stay untouched unless a confirmed bug requires it. Every change is explained before it lands and uses the smallest possible diff.

## Guardrails (apply to every phase)

- Before editing: state the issue, why it matters, severity (Critical/High/Medium/Low), risk, and the minimal diff.
- After editing: run `tsgo`, `eslint`, `bun run build`, and existing vitest/playwright suites. If any go red, revert and re-plan.
- Ask before touching: anything in `src/components/ui/*` shadcn primitives, any `*.tsx` page layout, `index.css` tokens, `tailwind.config.ts`, RLS policies, Supabase migrations, edge function business logic, or Razorpay/Stripe flows.
- Skip: design tokens, animation timings, chat UI, dashboard arrangement (per project memory — recently stabilized).

## Phase 1 — Read-only discovery (no code changes)

Investigate and produce a baseline report. Tools: `code--dependency_scan`, `security--run_security_scan` + `get_scan_results`, `supabase--linter`, `supabase--slow_queries`, `acp_subagent--explore` for cross-cutting searches (unused exports, dead files, duplicate components, missing error boundaries, `console.log` leaks, `dangerouslySetInnerHTML`, `localStorage` of sensitive data, `any` types, unhandled promises, missing `useEffect` cleanups, hardcoded keys).

Deliverable: a written audit report with findings grouped by severity across all 16 audit areas. **No file edits in this phase.** You approve which Critical/High items I proceed to fix.

## Phase 2 — Critical fixes (security, leaks, crashes)

Only items confirmed Critical in Phase 1. Expected categories:

- Exposed secrets / service-role key misuse / `dangerouslySetInnerHTML` with user input.
- Supabase RLS gaps surfaced by the linter or security scanner.
- Realtime subscriptions leaking (channels created outside `useEffect` or missing `removeChannel` cleanup).
- `useEffect` memory leaks (missing AbortController, listeners not removed, intervals not cleared).
- Unhandled promise rejections in auth/payment flows that can crash the route.

Each fix shipped as an isolated commit-sized change with verification.

## Phase 3 — High-priority fixes (errors, types, a11y blockers)

- Missing error boundaries on top-level routes; silent `.catch(() => {})` that swallows real errors → route to logger/toast.
- TypeScript errors and unsafe `any` in hot paths (auth, payments, messaging).
- ESLint errors (not stylistic warnings).
- WCAG blockers only: icon-only buttons without `aria-label`, images without `alt`, form inputs without labels, duplicate ids in lists, missing `<main>`, focusable elements inside `aria-hidden`.
- Dependency vulnerabilities flagged Critical/High by `code--dependency_scan` — patch-version bumps only; majors stay as recommendations.

## Phase 4 — Medium fixes (perf, dead code, docs, CI)

- Dead code: unused files (verified via repo-wide import search), unused imports, unused devDependencies.
- Duplicate utility code consolidated only when call sites are <5 and signature is identical.
- Obvious perf wins: missing `React.memo` on pure list items rendered >50× per page, missing `key` props, expensive `useMemo` candidates only when measured.
- README: add Local Setup, Environment Variables (required vs optional), GitHub Secrets table, E2E setup, Storybook/Chromatic setup. No re-org of existing docs.
- CI: upload Playwright HTML report + traces with explicit retention (14 days PR, 30 days main); add an authenticated dashboard smoke job gated on `E2E_SUPABASE_SESSION_JSON`; cache `bun install` and Playwright browsers; surface failures as PR check.
- Chromatic: fail the build on visual diffs for `ChatFullscreenPreview` (remove `exitOnceUploaded`, add `exitZeroOnChanges: false` only on changed stories).

## Phase 5 — Low / deferred (report only, no changes)

Listed as recommendations for you to schedule: major dependency upgrades, larger refactors, additional test coverage beyond smoke, responsive breakpoint sweep (requires authenticated Playwright runs you'd need to wire credentials for), observability/monitoring tooling, rate-limiting strategy for edge functions.

## Final deliverable

A single Markdown report at `/mnt/documents/audit-report.md` with:

- Executive summary + risk posture
- Findings by severity (Critical / High / Medium / Low)
- What was fixed (file + one-line rationale per change)
- What remains and why (deferred / out-of-scope / needs your decision)
- Recommended future improvements with effort estimate

## Technical notes

- Build verification per change: `bunx tsgo --noEmit` + `bun run lint` + `bun run build` + `bunx vitest run` + `bunx playwright test --project=mobile-iphone` (public-smoke specs only unless session secret is wired).
- Authenticated E2E: `LOVABLE_BROWSER_AUTH_STATUS=external_unmanaged` in this sandbox, so I cannot run authenticated dashboard tests locally — the new CI job will exercise them when you add `E2E_SUPABASE_SESSION_JSON` to repo secrets.
- Realtime audit pattern: search for `supabase.channel(` outside `useEffect` bodies and any subscription without a matching `removeChannel` in the cleanup.
- Security scan: re-run `security--run_security_scan` between Phase 2 and Phase 3 to confirm Critical findings cleared.
- Migrations: no schema edits planned. If the linter surfaces a missing GRANT on an existing public table, I'll flag it and ask before writing a migration.

## What I will NOT do without explicit approval

- Touch any file under `src/components/ui/`, `src/index.css`, `tailwind.config.ts`, or any page layout.
- Modify chat, dashboard arrangement, profile completion, or currency logic (recently stabilized per project memory).
- Upgrade React, Vite, Tailwind, Supabase JS, or any major version.
- Add new runtime dependencies.
- Change RLS policies, edge function behavior, or DB schema.
- Edit working tests.

Approve and I'll start Phase 1 (read-only discovery) and come back with the baseline report before touching any code.
