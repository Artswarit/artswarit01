# Artswarit Design Tokens

Single source of truth for colors, spacing, radii, typography, shadows, motion, and icon sizing.

All tokens are defined as CSS variables in `src/index.css` and exposed to Tailwind via `tailwind.config.ts`. **Never hardcode colors, gradients, or shadows in components.** Always reference a token.

---

## 1. Color System

### Semantic surface tokens (`src/index.css` → `:root` / `.dark`)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--background` | `220 70% 98%` | `220 30% 10%` | Page background |
| `--foreground` | `220 10% 10%` | `220 20% 98%` | Default text |
| `--card` / `--card-foreground` | white / near-black | dark slate / near-white | Card surface + text |
| `--popover` / `--popover-foreground` | white / near-black | dark slate / near-white | Popovers, dropdowns |
| `--primary` / `--primary-foreground` | `250 70% 60%` / white | same / white | Primary actions, focus ring |
| `--secondary` / `--secondary-foreground` | `220 20% 96%` / near-black | `220 20% 18%` / near-white | Secondary surfaces |
| `--muted` / `--muted-foreground` | `220 20% 96%` / `220 10% 40%` | `220 20% 18%` / `220 20% 60%` | Subtle surfaces and meta text |
| `--accent` / `--accent-foreground` | `250 70% 96%` / `250 70% 30%` | `250 30% 20%` / `250 70% 80%` | Hover states, highlights |
| `--destructive` / `--destructive-foreground` | `0 84.2% 60.2%` / near-white | `0 62.8% 30.6%` / near-white | Destructive actions, errors |
| `--border` / `--input` / `--ring` | `220 20% 90%` / `220 20% 90%` / `220 70% 60%` | `220 20% 20%` / `220 20% 20%` / same | Borders, inputs, focus ring |

**Tailwind usage:** `bg-background`, `text-foreground`, `bg-primary text-primary-foreground`, `border-border`, `ring-ring`, etc.

### Brand tokens (canonical gradient)

The "Artswarit purple → blue" gradient is the brand mark. It is defined once:

| Token | Value | Notes |
| --- | --- | --- |
| `--brand-from` | `#7C4DFF` (a.k.a. `artswarit.purple`) | Start of the brand gradient |
| `--brand-to` | `#3B82F6` (Tailwind `blue-500`) | End of the brand gradient |
| `--brand-from-dark` | `#5E35B1` | Hover / pressed state |
| `--brand-to-dark` | `#2563EB` (Tailwind `blue-600`) | Hover / pressed state |
| `--gradient-brand` | `linear-gradient(135deg, var(--brand-from), var(--brand-to))` | Composite gradient |

**Tailwind usage:**

```tsx
// ✅ Use the brand utility
<div className="bg-brand-gradient text-white">Hero CTA</div>
<h2 className="text-brand-gradient">Section title</h2>

// ❌ Don't redefine the gradient inline
<div className="bg-gradient-to-r from-artswarit-purple to-blue-500">…</div>
```

The legacy `artswarit.*` Tailwind colors and `text-gradient-purple` / `text-gradient-blue` utility classes still resolve to the same values for backwards compatibility, but new code must use the brand tokens above.

### Color rules

- **Never** use `text-white`, `bg-black`, `text-gray-500`, hex literals, or arbitrary brand utilities directly in components — they bypass dark-mode theming.
- The only acceptable places for raw color values are: (a) third-party vendored components (e.g. `src/components/ui/chart.tsx`), (b) the brand gradient overlays (`from-black/70` etc. in image overlays), (c) social-platform brand colors (Razorpay, WhatsApp, Stripe) that must match an external brand spec.
- `text-primary-foreground` is the only correct pairing for `bg-primary`. Likewise `text-destructive-foreground` for `bg-destructive`, etc.

---

## 2. Spacing Scale

Tailwind default 4px grid. Do not introduce arbitrary values (`p-[13px]`) outside one-off layout fixes.

| Token | Pixels | Common use |
| --- | --- | --- |
| `1` | 4 | Hairline gaps |
| `2` | 8 | Icon-to-text gap |
| `3` | 12 | Compact padding |
| `4` | 16 | Default card padding (mobile) |
| `6` | 24 | Default card padding (desktop), section gap |
| `8` | 32 | Major section padding |
| `12` | 48 | Hero spacing |
| `16` | 64 | Page-level vertical rhythm |

### Layout-specific spacing variables

| Variable | Value | Use |
| --- | --- | --- |
| `--navbar-height-mobile` | `4rem` (64px) | Mobile top spacing |
| `--navbar-height-desktop` | `5rem` (80px) | Desktop top spacing |
| `--safe-top` | `env(safe-area-inset-top, 0px)` | Notch / status bar |
| `--safe-bottom` | `env(safe-area-inset-bottom, 0px)` | Home indicator + mobile nav |

Reference these directly (`pt-[var(--safe-top)]`, `pb-safe`) rather than hardcoding `pt-12`.

---

## 3. Border Radius

| Token | Value | Use |
| --- | --- | --- |
| `--radius` | `0.75rem` (12px) | Base radius |
| Tailwind `rounded-sm` | `calc(var(--radius) - 4px)` = 8px | Small inputs, badges |
| Tailwind `rounded-md` | `calc(var(--radius) - 2px)` = 10px | Buttons, chips |
| Tailwind `rounded-lg` | `var(--radius)` = 12px | Cards, dialogs |
| Tailwind `rounded-xl` | 16px (Tailwind default) | Large cards |
| Tailwind `rounded-2xl` | 24px | Mobile sheets, glass cards |
| Tailwind `rounded-full` | 9999px | Avatars, pills, badges |

**Rule:** stick to this scale. Don't use `rounded-[14px]`.

---

## 4. Shadows

| Token | Value | Use |
| --- | --- | --- |
| `--shadow-xs` | `0 1px 2px hsl(220 10% 10% / 0.05)` | Subtle hairline (inputs) |
| `--shadow-sm` | `0 2px 8px hsl(220 10% 10% / 0.06)` | Resting cards |
| `--shadow-md` | `0 8px 24px hsl(220 10% 10% / 0.08)` | Hover lift |
| `--shadow-lg` | `0 20px 60px -30px hsl(220 10% 10% / 0.3)` | Modals, popovers |
| `--shadow-elevated` | `0 30px 80px -40px hsl(220 10% 10% / 0.4)` | Hero, primary CTAs |
| `--shadow-brand` | `0 10px 30px -10px hsl(var(--primary) / 0.3)` | Branded buttons |

**Tailwind usage:** `shadow-token-sm`, `shadow-token-md`, `shadow-token-lg`, `shadow-token-elevated`, `shadow-token-brand`.

Legacy `.neo-blur-sm/md/lg` utilities remain for backwards compatibility but should be replaced with token shadows in new work.

---

## 5. Typography

| Family | Tailwind | Use |
| --- | --- | --- |
| `Inter` | `font-sans` (default) | Body, UI text |
| `Poppins` | `font-heading` (auto-applied to `h1`–`h6`) | Headings |

### Weight scale (do not change without product approval)

- `font-medium` (500) — body emphasis
- `font-semibold` (600) — labels, secondary headings
- `font-bold` (700) — primary buttons, card titles
- `font-black` (900) — display headings, brand assertions (intentional, do not soften)

### Fluid sizes (`src/index.css` utilities)

`.text-fluid-xs` → `.text-fluid-3xl` use `clamp()` to scale between mobile and desktop. Prefer these over hardcoded `text-sm sm:text-base md:text-lg` ladders.

---

## 6. Icon Sizing

| Context | Class | Pixels |
| --- | --- | --- |
| Inline text icon | `h-4 w-4` | 16 |
| Default button icon | `h-5 w-5` | 20 |
| Large CTA icon | `h-6 w-6` | 24 |
| Nav / dashboard tab icon | `h-5 w-5` | 20 |
| Avatar fallback initial | size derives from avatar | — |

All Lucide icons should use these exact sizes — no `h-[18px]`. Wrap icon-only buttons with `aria-label`.

---

## 7. Motion

| Token | Value | Use |
| --- | --- | --- |
| `--ease-apple` | `cubic-bezier(0.22, 1, 0.36, 1)` | All UI transitions (default) |
| `--ease-apple-in` | `cubic-bezier(0.32, 0, 0.67, 0)` | Exits only |

Durations:
- `120ms` — micro press feedback
- `200ms` — buttons, hover lifts
- `300ms` — dialogs, sheets, dropdowns
- `500ms` — page-level reveals (use sparingly)

`.tap-scale` applies the canonical active-scale (`0.97`). Use it for every primary tap target.

---

## 8. Component Loading State

**Always** use the shared `Button` `loading` / `loadingText` props. Do not implement local spinners inside form submits.

```tsx
<Button type="submit" loading={isSubmitting} loadingText="Saving…">
  Save
</Button>
```

---

## 9. Migration Checklist (open work for later batches)

These are intentionally left in place during Batch 1 and tracked here:

1. **`artswarit-purple` → `bg-brand-gradient`** — ~20 call sites in `Index.tsx`, `EmailVerification.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, `Categories.tsx`, `ClientDashboard.tsx`, `ProjectRating.tsx`, `EarningsAnalysis.tsx`, `TopLoadingBar.tsx`, `TestLinks.tsx`. Drop the inline `bg-gradient-to-r from-artswarit-purple to-blue-500` for the utility.
2. **Raw `text-white` / `bg-white`** — 84 component-level usages outside `ui/`. Replace with `text-primary-foreground` (on `bg-primary` surfaces) or `text-card-foreground` / `bg-card` (on themed surfaces). Footer (dark surface) is an exception — keep `text-white/70` etc., or migrate to a `--footer-foreground` token.
3. **`bg-red-500`, `bg-blue-100`** — unread / verified badges. Replace with `bg-destructive`, `bg-accent text-accent-foreground`.
4. **Local `<Loader2 className="animate-spin" />` blocks inside submit buttons** — replace with the `Button` `loading` prop.
5. **`neo-blur-*` shadow classes** — migrate to `shadow-token-*`.

These migrations are queued for Batch 5 (Component Refactoring) per the agreed plan.

---

## 10. Hard "Do Not Change" rules

Per product decision, the following are intentional and must not be touched:

- Typography weight choices (especially `font-black` on display headings).
- Avatar rounded-square shape (`rounded-xl`).
- The base radius scale.
- Shadow style (depth, not heavy drop shadows).
- Existing layouts.
- Navigation architecture (no modal-to-page conversions).
