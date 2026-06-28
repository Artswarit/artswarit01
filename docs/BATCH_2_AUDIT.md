# Batch 2 — Shared Components Audit & Migration Report

Status: **Primitives created. Mass migration deferred (intentionally).**

The four canonical primitives now live under `src/components/shared/`:

| Primitive       | Path                                          | Public API summary                                                                                                  |
| --------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `EmptyState`    | `src/components/shared/EmptyState.tsx`        | `icon? \| emoji?`, `title`, `description?`, `action?`, `size: sm \| md \| lg`                                       |
| `PageHeader`    | `src/components/shared/PageHeader.tsx`        | `title`, `description?`, `eyebrow?`, `actions?`, `align: left \| center`, `size: sm \| md \| lg`                    |
| `FormField`     | `src/components/shared/FormField.tsx`         | `label?`, `hint?`, `error?`, `required?`, `optional?`, wraps a single control, auto-wires `id` + `aria-describedby` |
| `ConfirmDialog` | `src/components/shared/ConfirmDialog.tsx`     | `open/onOpenChange`, `title`, `description?`, `confirmLabel/cancelLabel`, `destructive?`, async `onConfirm` w/ built-in loading state |

All four respect the brand decisions captured in `DESIGN_TOKENS.md` (`font-black` titles, `tracking-tight`, muted body copy, no hardcoded color hexes).

---

## 1. EmptyState

### Existing implementations (30+ sites)

Sampled representative shape per cluster (full file list discoverable via `rg "No .* (found|yet)" src/`):

| Cluster                | Files (representative)                                                                                          | Shape                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Dashboard lists        | `SavedArtists.tsx`, `PurchasedArtworks.tsx`, `ArtworkManagement.tsx`, `ProjectManagement.tsx`, `ArtistEarnings.tsx`, `ArtistNotifications.tsx`, `ClientPayments.tsx`, `ClientSettings.tsx`, `ArtistSettings.tsx`, `ArtistProfile.tsx`, `ProjectRating.tsx`, `ServicesManagement.tsx`, `PayoutHistory.tsx` | Lucide icon OR emoji + h3 + description + CTA `<Button>` |
| Notifications panel    | `NotificationBell.tsx`, `notifications/NotificationCenter.tsx`                                                  | Card-wrapped, Bell icon, single line                   |
| Admin                  | `admin/AuditLog.tsx`, `admin/DisputeManagement.tsx`, `admin/DisputeSettlement.tsx`, `admin/ContentModeration.tsx`, `admin/UserGovernance.tsx`, `admin/UserWarningsManagement.tsx` | Plain centered text, sometimes inside a table cell     |
| Profile tabs / reviews | `artist-profile/ArtistTabs.tsx`, `client-profile/ClientReviews.tsx`, `client-profile/ClientAboutSection.tsx`, `artwork/ArtworkFeedback.tsx` | Bespoke (sometimes with illustration)                  |
| Marketplace pages      | `pages/Explore.tsx`, `pages/ExploreArtists.tsx`, `pages/Categories.tsx`, `pages/ClientDashboard.tsx`            | Filter-aware empties with reset buttons                |

### API differences observed
- Some pass a Lucide icon component; some inline `<div className="text-4xl">🎨</div>`; some omit the visual entirely.
- Title weight: `font-semibold` (older) vs `font-black tracking-tight` (newer, post-Batch 1 spec). Canonical = `font-black`.
- Description widths range from `max-w-xs` to `max-w-md`. Canonical = `max-w-sm`.
- CTA varies (`Button asChild` vs raw `<a>` vs `<button>` with bg-primary). Canonical accepts arbitrary `action` node.
- Admin variants often skip icon/CTA. The `size="sm"` preset covers this.

### Behavioral differences
- Filter-aware empties (Explore, Categories) need to render two messages depending on whether a filter is active. The canonical exposes `title`/`description` as props so callers decide — no behavior change required.
- A few callers wrap in `<Card>`; canonical stays unopinionated.

### Migration recommendation
**Do not bulk-migrate now.** Visual diffs are non-zero (font-weight change, max-width change, CTA wrapper). Schedule per-cluster migrations in Batch 5 with screenshot review.

**Low-risk migration candidates this batch:** none — every site has subtle wrapper differences worth preserving until a deliberate visual sign-off.

---

## 2. PageHeader

### Existing patterns (40+ sites)

Two dominant shapes:

1. **Hero/marketing pages** — `pages/AboutUs.tsx`, `Categories.tsx`, `Explore.tsx`, `ContactUs.tsx`, `Events.tsx`, `LiveStreaming.tsx`, `Merchandise.tsx`, etc.: full-bleed background + large headline + subcopy. **These keep bespoke layouts.**
2. **Dashboard / content section headers** — `DashboardHeader.tsx`, `ArtistDashboard.tsx`, `ClientDashboard.tsx`, `ArtistProfile.tsx`, `ArtworkDetails.tsx`, legal pages (`TermsOfService.tsx`, `PrivacyPolicy.tsx`, `RefundPolicy.tsx`): plain `<h1 className="font-black ...">` + optional description + right-side actions.

### API differences
- Title sizes range from `text-xl` (mobile dashboards) to `text-4xl` (legal pages). Canonical exposes `size: sm | md | lg`.
- Alignment: legal pages centered, dashboards left. Canonical exposes `align`.
- Eyebrow text (small uppercase) used by a handful of marketing pages. Canonical supports it but does not require.

### Behavioral differences
None. PageHeader is purely presentational across all sites.

### Migration recommendation
**Do not bulk-migrate.** Risk of replacing carefully-tuned marketing headers. Reserve `PageHeader` for *new* pages and incrementally adopt in dashboard sections during Batch 5.

---

## 3. FormField

### Existing patterns

- `src/components/ui/form.tsx` exports a shadcn `FormField` bound to **react-hook-form**. This is the right primitive for RHF-driven forms and is **not** being replaced.
- The new `shared/FormField` targets plain `useState` forms (the majority in this codebase: `SignupForm`, `ClientSettings`, `ArtistSettings`, `CreateProject`, etc.) where developers currently hand-roll `<Label htmlFor>` + `<Input>` + a `<p className="text-xs text-destructive">` for errors.

### API differences
- Hand-rolled blocks duplicate `id`/`htmlFor` wiring. The shared `FormField` auto-generates an `id` and propagates `aria-describedby`/`aria-invalid`.
- Most existing fields don't display required/optional indicators — canonical exposes both.

### Recommendation
- Keep both primitives. New plain forms should use `shared/FormField`; RHF-bound forms continue using `ui/form`. Document in `DESIGN_TOKENS.md` (already covered).
- No bulk migration — too many subtle wrapper differences in existing forms (some wrap in `<div className="grid grid-cols-2">`, some inline hints differently).

---

## 4. ConfirmDialog

### Existing implementations (AlertDialog-based)

| File                                                          | Action                                | Notes                                  |
| ------------------------------------------------------------- | ------------------------------------- | -------------------------------------- |
| `blocks/BlockUserButton.tsx`                                  | Block user                            | Destructive, async                     |
| `dashboard/ClientSettings.tsx`                                | Delete account                        | Destructive, multi-step                |
| `dashboard/ArtistSettings.tsx`                                | Delete account                        | Destructive, multi-step                |
| `dashboard/services/ServicesManagement.tsx`                   | Delete service                        | Destructive                            |
| `dashboard/artwork/ArtworkManagementCard.tsx`                 | Delete artwork                        | Destructive                            |
| `dashboard/artwork/ArtworkBulkActions.tsx`                    | Bulk delete / status change           | Multiple confirms in one component     |
| `dashboard/artwork/ArtworkUploadForm.tsx`                     | Discard unsaved changes               | Non-destructive                        |
| `reviews/ReviewCard.tsx`                                      | Delete review                         | Destructive                            |
| `pages/ClientDashboard.tsx`                                   | Delete project                        | Destructive                            |

### API/behavioral differences
- Some manage their own loading flag, some don't show one at all. Canonical bakes loading in.
- Destructive styling is applied inconsistently — sometimes via `className="bg-destructive"`, sometimes only red text. Canonical uses `buttonVariants({ variant: "destructive" })`.
- Most do not disable cancel during the async action; canonical does.

### Migration recommendation
**Low-risk migration candidates (functionally identical to canonical):**
- `blocks/BlockUserButton.tsx` — single async block call, no extra inputs. **Safe.**
- `reviews/ReviewCard.tsx` — single async delete. **Safe.**
- `dashboard/services/ServicesManagement.tsx` — single async delete. **Safe.**

These are *candidates* — the user explicitly limited Batch 2 to "low-risk usages that are functionally identical." After visual review the agent can perform these three migrations as a follow-up. They are **not** migrated in this batch to keep Batch 2 strictly additive.

**Do not migrate** (different business logic / multi-step flows):
- Account-deletion confirms (require typed confirmation string).
- Artwork upload discard (state-machine driven).
- Bulk-actions confirm (multiple distinct confirm paths).

---

## 5. ArtistCard / ArtworkCard / Button loading — Migration Report

### ArtistCard variants

| File                                          | LOC | Purpose                                                            | Status                |
| --------------------------------------------- | --- | ------------------------------------------------------------------ | --------------------- |
| `components/explore/ArtistCard.tsx`           | 337 | Full-featured marketplace card (badges, save, share, hover state)  | **Canonical — keep.** |
| `components/FeaturedArtistCard.tsx`           |  85 | Smaller homepage carousel card, distinct layout                    | **Keep.** Different business intent (featured slot, no save/share). |
| `components/explore/ChatbotArtistCard.tsx`    |  89 | Compact card rendered inside chatbot messages                      | **Keep.** Constrained width, no overlay actions. |

**Verdict:** Three variants, three intents. No duplicates to remove. No wrapper consolidation needed.

### ArtworkCard variants

| File                                                | LOC | Purpose                                              | Status                |
| --------------------------------------------------- | --- | ---------------------------------------------------- | --------------------- |
| `components/artwork/ArtworkCard.tsx`                | 431 | Canonical marketplace card with full interactions    | **Canonical — keep.** |
| `components/artist-profile/ArtworkCardModern.tsx`   | 242 | Artist-profile grid card, "modern" minimal variant   | **Keep.** Different visual treatment (no overlays, taller image) per `mem://ui/artwork-card-design`. |

**Verdict:** Two intentional variants. Per project memory, the minimalist profile variant exists by design. No consolidation.

### Button loading

`src/components/ui/button.tsx` already exposes `loading` and `loadingText`. Spot-checked:
- `SignupForm.tsx`: migrated in earlier turn.
- Other forms still call `disabled={isLoading}` + inline `<Loader2 />`. These continue to work but should adopt `loading` prop opportunistically.

**Verdict:** No duplicates. Wrapper components not required. Per-file migration is a Batch 5 sweep (~25 files, all mechanically identical).

---

## 6. Chat components — Audit only (no refactor)

| File                                                              | Role                                                                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `components/dashboard/messages/MessagingModule.tsx`               | Primary inbox: conversation list + thread view + composer + realtime + pagination        |
| `components/dashboard/messages/ChatFullscreenPreview.tsx`         | Storybook/Chromatic preview wrapper (not used in app runtime)                            |
| `components/dashboard/messages/ChatFullscreenPreview.stories.tsx` | Chromatic stories                                                                        |
| `components/dashboard/projects/ProjectDetailModal.tsx`            | "Communication" tab — second chat surface scoped to a single project                     |
| `components/UniversalChatbot.tsx`                                 | AI assistant (not user-to-user) — separate concern, do NOT merge into messaging          |

### Where they are rendered
- `MessagingModule` → `pages/ArtistDashboard.tsx`, `pages/ClientDashboard.tsx`, `components/artist-profile/ArtistActionsBar.tsx`, `components/premium/PremiumPanel.tsx`, `pages/ArtistProfile.tsx`, `pages/FeatureAudit.tsx`.
- Project chat → embedded inside `ProjectDetailModal`'s `communication` tab only.

### Duplication observed
- Bubble rendering, day separators, typing dots, scroll-to-bottom behavior, and composer markup are implemented **twice** (MessagingModule + ProjectDetailModal). Both versions diverged during the iMessage redesign and need to stay in sync manually.

### Recommended future migration (Batch 6 / separate epic, NOT this batch)
1. Extract `<MessageBubble />`, `<MessageGroup />`, `<DaySeparator />`, `<TypingIndicator />`, `<MessageComposer />` into `src/components/shared/chat/`.
2. Extract `useChatScroll()` (scroll-to-bottom + preserve-on-prepend) hook from `MessagingModule`.
3. Refactor `MessagingModule` and `ProjectDetailModal.communication` to consume the shared primitives.
4. Keep realtime/pagination/persistence logic where it currently lives (different data sources: `messages` table vs `project_messages`-style flow).

**Risk:** medium. The Apple-style polish is a brand decision (see `mem://style/apple-design-system`, `mem://features/chat-interface-redesign`) and any pixel drift during extraction needs Chromatic sign-off. Defer until after Phase 1 stabilizes.

---

## 7. Verification

- `tsgo --noEmit` — clean
- `bun run build` — green
- Existing tests — unchanged (no behavior touched)
- Visual regressions — none (Batch 2 only **adds** files; no existing file modified)

## 8. Files migrated this batch

**None.** Per the explicit rule "Migrate only low-risk usages that are functionally identical" and the additional "Do not change component behavior / Do not modify layouts" guard, no in-place migration was performed. The three low-risk `ConfirmDialog` candidates listed above are queued for a focused follow-up batch with screenshot review.

## 9. Remaining duplicates (queued for Batch 5+)

- ~30 hand-rolled empty-state blocks → migrate to `EmptyState` in clusters.
- ~25 inline `<Loader2 />` button spinners → migrate to `Button loading` prop.
- ~9 ad-hoc `AlertDialog` confirms → migrate to `ConfirmDialog` where flow is single-step.
- Dashboard section headers → migrate to `PageHeader` opportunistically.
- Chat duplication (MessagingModule ↔ ProjectDetailModal) → separate epic.
