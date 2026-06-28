# Dashboard / Chat Playwright Regression Tests

These tests guard the chat fullscreen modal, safe-area padding, and tab scroll-to-top behavior on the client and artist dashboards.

## Why they're not in CI by default

Authenticated dashboard routes (`/artist-dashboard`, `/client-dashboard`) require a Supabase session. The tests support two modes:

1. **Session injection (preferred for CI)** — set `E2E_SUPABASE_SESSION_JSON` and `E2E_SUPABASE_STORAGE_KEY` env vars to a pre-minted Supabase session JSON and the project's `sb-<ref>-auth-token` localStorage key. The tests will hydrate `localStorage` before navigating.
2. **Public smoke mode** — when no session is provided, the tests fall back to verifying the public surface (no horizontal overflow, safe-area variables wired) so the suite still produces signal.

## Run locally

```bash
# Install Playwright once
bunx playwright install chromium

# Start dev server in another terminal
bun run dev

# Run the suite
bunx playwright test tests/e2e
```

To run with a real session:

```bash
export E2E_SUPABASE_STORAGE_KEY="sb-sqdzemlcqesgjsybbhte-auth-token"
export E2E_SUPABASE_SESSION_JSON="$(cat ./.local/test-session.json)"
bunx playwright test tests/e2e
```

## What's covered

| File | Scenario |
| --- | --- |
| `chat-modal.spec.ts` | Selecting a conversation opens a fullscreen overlay (`z-index >= 100`, fills the viewport, hides bottom tab bar). |
| `chat-modal.spec.ts` | Composer respects `env(safe-area-inset-bottom)` and is not clipped. |
| `chat-modal.spec.ts` | "Load older messages" pill renders above the thread and preserves scroll position after click. |
| `dashboard-layout.spec.ts` | No horizontal overflow at 375, 414, 768, 820, 1024 px. |
| `dashboard-layout.spec.ts` | Switching dashboard tabs scrolls the page to top (no carry-over scroll position). |
| `dashboard-layout.spec.ts` | Mobile bottom nav stays above safe-area-inset-bottom and does not clip the last component. |
