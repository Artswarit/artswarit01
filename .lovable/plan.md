
## Goal
Run a full UI/UX self-audit across the entire app and fix bugs, inconsistencies, and broken behaviors — without altering the color palette, fonts, or overall layout/design direction.

## Approach
I'll do this in passes, each touching a focused concern across all pages/components so the diff stays reviewable. After each pass I verify via build + Playwright screenshots at 320 / 768 / 1280 widths.

### Pass 1 — Global primitives (foundation)
Normalize the shared building blocks so downstream fixes propagate automatically.
- `src/components/ui/button.tsx` — single source of truth for height, radius, padding, font-weight, hover/active/disabled, and `loading` prop (spinner + auto-disabled).
- `src/components/ui/input.tsx`, `textarea.tsx`, `select.tsx` — uniform height (h-11 mobile / h-10 desktop), radius, border, focus ring, error state.
- New `PasswordInput` wrapper with show/hide toggle; replace raw `<Input type="password">` usages.
- Tailwind/`index.css` tokens: standardize `--radius`, shadow scale (sm/md/lg/xl), spacing scale — no color changes.

### Pass 2 — Responsiveness sweep (320 / 768 / 1280)
For every page in `src/pages/*` and every dashboard view:
- Replace fixed widths/`min-w-[…px]` that cause horizontal scroll with responsive equivalents.
- Wrap overflowing tables/tab strips in `overflow-x-auto` with fade indicators (per existing pattern).
- Ensure touch targets ≥ 44×44 on mobile (icon buttons get `min-h-11 min-w-11`).
- Fix text overflow with `truncate` / `line-clamp` / `break-words` where clipping occurs.
- Verify safe-area padding on auth, dashboard, settings, and modal headers.

### Pass 3 — Navigation & mobile menu
- `Navbar.tsx` + mobile drawer: single close button, closes on nav-item click, focus trap, body scroll lock.
- Audit all nav links and dashboard tab links — remove/fix dead links and buttons without handlers.

### Pass 4 — Forms & auth flows
- Login, Signup, ForgotPassword, ResetPassword, Contact, Commission, Settings forms:
  - Visible inline validation (zod + react-hook-form messages rendered).
  - Submit buttons use new `loading` prop → disabled + spinner during submit.
  - Password fields use `PasswordInput`.
- Post-auth redirect: confirm role-based redirect (artist → `/artist-dashboard`, client → `/client-dashboard`, admin → `/admin`) on login, signup-confirm, and logout (→ `/`).
- `ProtectedRoute.tsx`: show spinner while auth resolves; never blank.

### Pass 5 — Loading & error states
- Every `useQuery`/fetch site: add skeleton or spinner; render error toast + retry; remove silent failures.
- Empty states for lists (no artworks, no notifications, no messages) get a consistent empty component.

### Pass 6 — Visual consistency pass
- Cards/modals/inputs/buttons radius unified to design tokens.
- Shadow audit — replace ad-hoc `shadow-[…]` with token scale.
- Icon size audit per context (navbar 20, card 16, hero 24).
- CTA hierarchy: ensure exactly one primary button per action group; secondary uses `variant="outline"` or `"ghost"`.

### Pass 7 — Verification
- `bun run build` clean.
- Playwright script visits ~15 key routes at 320/768/1280, screenshots, checks `document.scrollingElement.scrollWidth <= clientWidth` (no horizontal scroll), dumps console errors.
- Manual review of screenshots for clipped text / broken layouts.

## Out of scope (per your instructions)
- No color palette changes.
- No font changes.
- No page redesigns or layout overhauls.
- No new features.

## Risk / size
This will touch a large number of files (primitives + most pages). Expect ~40–80 files edited across the passes. I'll keep each pass as a focused batch so you can stop me between passes if anything drifts.

## Confirm to proceed
Reply "go" and I'll start with Pass 1. If you'd rather I scope down (e.g., "only auth + dashboards", or "skip Pass 5"), tell me which passes to run.
