# Artswarit

India's leading artist marketplace. React + Vite + Tailwind on the frontend, Supabase (Postgres + Edge Functions + Storage) on the backend.

- Live: https://artswarit.lovable.app
- Lovable project: https://lovable.dev/projects/ad410895-a5fb-4009-8f40-d50b67eab824

## Tech stack

- **App**: React 18, Vite 5, TypeScript 5, Tailwind v3, shadcn/ui
- **Backend**: Supabase (Auth, Postgres + RLS, Storage, Edge Functions on Deno)
- **Payments**: Razorpay (INR) and Stripe (USD), routed via `useCurrencyFormat`
- **Realtime**: Supabase Realtime channels (user-scoped)
- **Testing**: Vitest (unit), Playwright (E2E), Storybook + Chromatic (visual)

## Local setup

```bash
bun install
bun run dev          # starts vite on http://localhost:8080
```

A `.env` file is auto-populated in Lovable with the publishable Supabase keys. For local checkouts outside Lovable, create a `.env` at the project root:

```bash
VITE_SUPABASE_URL=https://sqdzemlcqesgjsybbhte.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
VITE_SUPABASE_PROJECT_ID=sqdzemlcqesgjsybbhte
```

These keys are **publishable** (safe to commit if you must). Never commit service-role keys or third-party secrets — those live in Supabase Edge Function secrets.

## Scripts

| Command | Purpose |
| --- | --- |
| `bun run dev` | Vite dev server on :8080 |
| `bun run build` | Production build |
| `bun run lint` | ESLint over `src/` and `supabase/functions/` |
| `bun run test` | Vitest unit + light integration tests |
| `bun run test:e2e` | Playwright across all viewports |
| `bun run test:e2e:mobile` | Playwright on mobile projects only |
| `bun run test:e2e:tablet` | Playwright on tablet projects only |
| `bun run storybook` | Storybook on :6006 (visual stories) |
| `bun run build-storybook` | Static Storybook build (used by Chromatic) |
| `bun run chromatic` | Local Chromatic publish (needs `CHROMATIC_PROJECT_TOKEN`) |

## Environment variables

### Frontend (`.env` / Vite)

| Variable | Required | Source | Notes |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Supabase project | Auto-injected on Lovable |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase project | Anon/publishable key — safe in client bundle |
| `VITE_SUPABASE_PROJECT_ID` | Yes | Supabase project | Used by client config |

### Supabase Edge Function secrets

Managed in the Supabase dashboard or via the Lovable `add_secret` tool. **Never** put these in `.env`.

| Secret | Required | Used by |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | All edge functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Admin operations inside edge functions only |
| `SUPABASE_ANON_KEY` | Yes | Caller-context edge functions |
| `RAZORPAY_KEY_ID` | Yes (INR payments) | Razorpay order + verification |
| `RAZORPAY_KEY_SECRET` | Yes (INR payments) | Razorpay order + verification |
| `RAZORPAYX_KEY_ID` | Yes (artist payouts) | Auto-approval payouts |
| `RAZORPAYX_KEY_SECRET` | Yes (artist payouts) | Auto-approval payouts |
| `RAZORPAYX_ACCOUNT_NUMBER` | Yes (artist payouts) | Auto-approval payouts |
| `STRIPE_SECRET_KEY` | Optional (USD payments) | Stripe checkout / webhooks |
| `LOVABLE_API_KEY` | Optional | Lovable AI gateway calls |
| `OPENAI_API_KEY` | Optional | AI assistant fallback |
| `GROQ_API_KEY` | Optional | AI assistant fallback |
| `GOOGLE_GEMINI_API_KEY` | Optional | AI assistant fallback |
| `HIVE_API_KEY` | Optional | AI content detection |

## GitHub Actions secrets

Used by `.github/workflows/`. Configure at **Repo → Settings → Secrets and variables → Actions**.

| Secret | Required | Workflow | Purpose |
| --- | --- | --- | --- |
| `CHROMATIC_PROJECT_TOKEN` | **Required** for `chromatic.yml` | Visual regression | Without it the Chromatic job no-ops |
| `E2E_SUPABASE_SESSION_JSON` | Optional | `e2e.yml` | Pre-minted Supabase session JSON; when present, authenticated dashboard specs run |
| `E2E_SUPABASE_STORAGE_KEY` | Optional, pairs with the above | `e2e.yml` | The `sb-<project-ref>-auth-token` localStorage key |

If the two `E2E_*` secrets are absent, `e2e.yml` still runs the public-surface specs (no-overflow, safe-area checks). Only the authenticated dashboard smoke test is skipped.

## End-to-end (Playwright)

```bash
bunx playwright install chromium    # one-time
bun run dev                         # in one terminal
bun run test:e2e                    # in another
```

To test authenticated dashboards locally, mint a Supabase session from the browser (DevTools → Application → Local Storage → copy the `sb-<ref>-auth-token` value) and export:

```bash
export E2E_SUPABASE_STORAGE_KEY="sb-sqdzemlcqesgjsybbhte-auth-token"
export E2E_SUPABASE_SESSION_JSON='{"access_token":"...","refresh_token":"...","expires_at":...,"user":{...}}'
bunx playwright test
```

Reports and traces from CI runs are uploaded as artifacts and retained for **14 days** on PRs / **30 days** on `main`. Download from the workflow run page.

See `tests/e2e/README.md` for the full list of scenarios covered.

## Visual regression (Chromatic)

```bash
bunx storybook@latest init --type react --builder vite   # one-time, if Storybook isn't yet installed
bun run build-storybook
CHROMATIC_PROJECT_TOKEN=chpt_xxx bunx chromatic
```

CI (`.github/workflows/chromatic.yml`) fails the build on accepted-baseline diffs for the chat preview stories across breakpoints 360, 390, 414, 768, 820, 1024. Approve or reject diffs in the Chromatic UI.

## Repository layout

```
src/
  components/        # UI primitives + feature components
  pages/             # Route components
  hooks/             # Shared React hooks
  contexts/          # Auth, Currency, Realtime providers
  integrations/      # Auto-generated Supabase client + types
  lib/               # Pure utilities
supabase/
  functions/         # Deno edge functions
  migrations/        # SQL migrations (managed via tool, do not hand-edit)
tests/e2e/           # Playwright specs
.github/workflows/   # CI
```

## Contributing

- Don't hand-edit `src/integrations/supabase/types.ts` — it's regenerated.
- Don't hand-edit files under `supabase/migrations/` — use the migration tool.
- Run `bun run lint` and `bun run build` before opening a PR.
- Keep changes scoped: UI changes stay in `src/components/**`, business logic in hooks or edge functions.

## License

Proprietary — Artswarit. All rights reserved.
