# Chromatic visual regression for the chat surface

The story files in this repo (`src/**/*.stories.tsx`) are excluded from the app's
`tsconfig.app.json` build so they don't require Storybook to be installed for
normal development. They are picked up the moment you wire Storybook in.

## One-time setup

```bash
# 1. Install Storybook + Chromatic addon
bunx storybook@latest init --type react --builder vite
bun add -D chromatic @chromatic-com/storybook

# 2. Add helpful viewports (mobile + tablet) — open .storybook/preview.ts
#    and merge in:
#
#    import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';
#    export const parameters = {
#      viewport: { viewports: INITIAL_VIEWPORTS },
#    };

# 3. Verify the chat stories render
bun run storybook
```

Open the "Dashboard / Chat / Fullscreen" sidebar entry — it has stories for
default mobile, the load-more pill (idle + loading), tablet, tablet landscape,
typing indicator, dense thread, and empty state.

## Run Chromatic locally

```bash
# Generate a project token at https://www.chromatic.com → New Project
export CHROMATIC_PROJECT_TOKEN=chpt_xxx
bunx chromatic
```

## CI (GitHub Actions example)

Add `.github/workflows/chromatic.yml`:

```yaml
name: Chromatic
on: [pull_request]
jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - uses: chromaui/action@latest
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          exitOnceUploaded: true
```

Then add `CHROMATIC_PROJECT_TOKEN` to your GitHub repo secrets.

## What the stories cover

Each story snapshot is captured by Chromatic at the breakpoints declared in the
story `parameters.chromatic.viewports` array (360, 390, 414, 768, 820, 1024).

| Story | What it guards |
| --- | --- |
| `Default (mobile)` | Baseline iMessage-style bubbles, grouping spacing |
| `Load older messages — idle` | Pill placement above the thread |
| `Load older messages — loading` | Spinner state of the pill |
| `With typing indicator` | Animated dots layout |
| `Tablet` / `Tablet landscape` | Layout integrity at iPad widths |
| `Dense thread (40 msgs)` | Long-thread spacing + scroll container |
| `EmptyState` | Empty conversation visual |
