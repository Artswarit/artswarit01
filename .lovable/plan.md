# Audit & Minimal Apple-Style Polish Plan

Goal: Fix backend/logic gaps in the chat flow, then apply minimum, non-redesign polish (motion, spacing, consistency, micro-interactions) across all pages and dashboards so it feels closer to Apple/iOS quality. No layout or color/palette changes.

---

## Phase 1 — Chat backend & logic audit (fix blockers first)

Targets: `src/components/dashboard/messages/MessagingModule.tsx`, `src/components/messages/MessageAttachments.tsx`, related Supabase tables (`messages`, `conversations`).

Checks & fixes:
- Verify conversation creation: existing-conversation lookup before insert (prevent duplicates between same client+artist+project).
- Confirm message send flow: optimistic UI insert, rollback on error, toast on failure (currently silent failures reported earlier).
- Realtime subscription: ensure single channel per conversation, proper cleanup on unmount, dedupe optimistic vs realtime echo.
- Unread/read receipts: mark-as-read on conversation open; badge count refresh.
- Attachments: file size + mime validation, signed URL refresh (1h), error toast on upload fail.
- Auth/role guard: only conversation participants can read/send (RLS sanity check via `security--get_scan_results`).
- Scroll behavior: auto-scroll to bottom on new message only when user is already near bottom; preserve scroll position on history load.
- Empty / loading / error states: skeleton list, "no messages yet" empty state, retry on send fail.
- Mobile: keyboard-safe composer (sticky bottom, safe-area inset), 44px touch targets, no horizontal scroll.

## Phase 2 — Chat UX polish (Apple-like)

- Message bubble enter animation (subtle fade+translate, 200ms ease-out).
- Typing indicator with animated dots.
- Timestamp grouping (show only on hover or every 5 min gap).
- Smooth conversation list selection (active highlight transition).
- Composer: auto-grow textarea, send button disabled state, Enter to send / Shift+Enter newline.
- Image attachment thumbnail preview before send.

## Phase 3 — Global primitives polish (affects all pages)

Files: `src/components/ui/button.tsx`, `card.tsx`, `input.tsx`, `tabs.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `tailwind.config.ts`, `index.css`.

- Standardize easing tokens: add `--ease-apple: cubic-bezier(0.22, 1, 0.36, 1)` and use across transitions.
- Button: refine active scale (0.97), 150ms ease, consistent focus ring.
- Card: unify shadow scale (sm/md/lg only), hover lift transition.
- Tabs: animated active indicator (slide), 200ms ease.
- Dialog/Sheet: spring-like open animation, backdrop blur consistency.
- Input/Textarea: focus ring transition smoothing.
- Page transitions: subtle fade between routes via a single wrapper (no router rewrite).

## Phase 4 — Dashboard polish (Artist + Client)

Files: `ArtistDashboard.tsx`, `ClientDashboard.tsx`, `DashboardHeader.tsx`, `DashboardMobileNav.tsx`, `DashboardAttentionRequired.tsx`, cards under `dashboard/`.

- Consistent section header sizing & spacing.
- Skeleton loaders on every data fetch (replace blank states).
- Stat cards: number count-up animation on mount.
- Mobile nav: smooth tab indicator transition, haptic-style press feedback.
- Empty states: friendly illustration text + single CTA.

## Phase 5 — Project detail & tabs polish

Files: `components/projects/*`, `components/dashboard/projects/ProjectDetailModal.tsx`, `MilestoneWorkflow.tsx`, `MilestoneCard.tsx`.

- Tabs animated indicator + content cross-fade.
- Milestone status chips: consistent color tokens, transition on status change.
- Action buttons: loading state on async actions (approve/submit/dispute).
- Modal: smooth open/close, focus trap, ESC close.
- Activity log: timeline animation on new entry.

## Phase 6 — Forms, buttons, text consistency sweep

- Audit all forms for: consistent input height, label spacing, inline error messages, submit-loading state, double-submit prevention.
- Typography: enforce consistent heading scale (h1/h2/h3) across pages via existing tokens.
- Buttons: same variant = same height/radius/weight everywhere (already started in prior pass — extend coverage to remaining pages: Commissions, Events, LiveStreaming, Merchandise, Collections, Categories).

## Phase 7 — Verification

- `tsgo` typecheck.
- Playwright sweep across chat (artist + client), project detail, dashboards at 320/768/1280; capture screenshots; check console for errors.
- Manual flow: create conversation → send message → attach file → mark read → realtime echo on second session.

---

## Technical notes

- Use existing `framer-motion` if installed; otherwise pure CSS transitions with the new easing token. Will check `package.json` first to avoid adding deps.
- No palette, font, or layout changes — only motion, spacing, consistency, missing states.
- All RLS / role logic stays as-is unless audit reveals a concrete bug.

## Out of scope

- Redesign of any page.
- New features (voice notes, reactions, etc.).
- Color/font changes.

Reply **"go"** to start with Phase 1 (chat backend audit + fixes), or tell me to reorder/skip phases.
