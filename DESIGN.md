# Design System: MediaTracker-AI — "Private Cinema + Lumen Content"

## 1. Visual Theme & Atmosphere

A dark, intimate private cinema where content emits light. The UI retreats; covers, colors, and emotional data take center stage. The atmosphere is a curated screening room — not a dashboard, not a tool, but a personal archive of cultural experiences. Each work's dynamic color tints its surroundings like a screen illuminating a dark room. Subtle neon luminescence bleeds from content, never from chrome.

**Spectrum:**
- Density: 5 — Content-rich but breathing. Not sparse, not cramped
- Variance: 7 — Asymmetric grids, offset layouts, visual rhythm breaks
- Motion: 6 — Fluid spring physics, staggered reveals, subtle micro-interactions. Cinematic but not theatrical

## 2. Color Palette & Roles

### Neutrals (Zinc-based — NO slate, NO blue undertones)

- **Void Black** `#09090B` — Deepest background, app canvas. Pure zinc-950
- **Deep Surface** `#111113` — Primary surface level. Cards outer shell, bottom nav, modals
- **Mid Surface** `#18181B` — Secondary surface. Card inner core, header glass pill, input backgrounds
- **Elevated Surface** `#1C1C1F` — Tertiary surface. Hover states, elevated panels, info sheets
- **Text Primary** `#FAFAFA` — zinc-50. Headlines, active labels, key data
- **Text Secondary** `#A1A1AA` — zinc-400. Descriptions, metadata, inactive labels
- **Text Tertiary** `#71717A` — zinc-500. Placeholder text, disabled states, hints
- **Hairline** `rgba(255,255,255,0.06)` — Structural borders, dividers. Ultra-subtle
- **Hairline Bright** `rgba(255,255,255,0.12)` — Active/hover borders, focus rings

### Dynamic Accent (Lumen Content)

There is NO fixed accent color. The accent is **always the dynamic color of the focused work** (`aiData.primaryColor`). This color tints:

- Card bottom gradient overlay
- Card outer shell shadow (lumen glow)
- Active status badge glow
- Header border tint when viewing an item detail
- Quick-action button glow
- Progress bar fill
- Active nav icon tint (derived from last-interacted work)

**Lumen Glow Values** (applied per-element, always using the work's dynamic color):

| Element | Shadow Value |
|---|---|
| Card (at rest) | `0 4px 24px rgba({dynamicRgb}, 0.10)` |
| Card (hover) | `0 8px 32px rgba({dynamicRgb}, 0.18)` |
| Status badge active | `0 0 12px rgba({statusColor}, 0.30)` |
| Rating circle | `0 0 8px rgba({dynamicRgb}, 0.25)` |
| Quick action button | `0 0 16px rgba({dynamicRgb}, 0.25)` |
| Login avatar ring | `0 0 20px rgba(99,102,241, 0.40)` |
| Header tint on detail | `0 1px 0 rgba({dynamicRgb}, 0.15)` inset bottom |

### Static Semantic Colors

- **Success** `#10B981` emerald-500 — Completed status, confirmations
- **Warning** `#F59E0B` amber-500 — "Sin empezar" status
- **Pause** `#F97316` orange-500 — Paused status
- **Planned** `#A855F7` purple-500 — Planned status
- **Danger** `#EF4444` red-500 — Discarded, delete, errors
- **Active** `#10B981` emerald-500 — "Viendo/Leyendo" status

### Banned

- ❌ `#6366F1` indigo as fixed primary — the dynamic color replaces it
- ❌ Slate grays (blue undertone) — use Zinc exclusively
- ❌ Pure `#000000` — always Void Black `#09090B`
- ❌ Neon text-shadow, neon outlines, neon borders
- ❌ Gradient text on large headers
- ❌ More than one lumen glow per card at rest

## 3. Typography Rules

### Font Stack

- **Primary:** `Geist` — Geometric grotesk, modern, technical but warm. Used for everything
- **Mono:** `Geist Mono` — Progress numbers, episode counts, timestamps, stat values
- **Fallback:** `ui-sans-serif, system-ui, -apple-system, sans-serif`

### Scale

| Role | Size | Weight | Tracking | Line-height |
|---|---|---|---|---|
| Page Title (H1) | `text-3xl` (1.875rem) | 800 | `-0.03em` | `1.1` |
| Section Title (H2) | `text-xl` (1.25rem) | 700 | `-0.02em` | `1.3` |
| Card Title | `text-base` (1rem) | 800 | `-0.02em` | `1.2` |
| Body | `text-sm` (0.875rem) | 400 | `0` | `1.6` |
| Label / Badge | `text-[10px]` | 800 | `0.1em` uppercase | `1.0` |
| Metadata / Caption | `text-xs` (0.75rem) | 500 | `0` | `1.4` |
| Mono Data | `text-xs` (0.75rem) | 600 mono | `0.02em` | `1.2` |

### Rules

- Headlines use weight + tracking for hierarchy, NOT just size
- Body text max-width `65ch` for readability
- Card titles: `line-clamp-2`, track-tight, font-black
- Badge text: ALL UPPERCASE, wide tracking, smallest size, heaviest weight
- Numbers in progress/stats: ALWAYS Geist Mono

### Banned

- ❌ Inter, Roboto, Arial, Open Sans, Helvetica as primary
- ❌ System font stack as final choice — Geist must be loaded
- ❌ Serif fonts in this context (dashboard/media tracker)
- ❌ `font-weight: 900` below `text-xl` — creates rendering artifacts at small sizes

## 4. Component Stylings

### Cards (CompactMediaCard)

**Double-Bezel Architecture (Doppelrand):**
- **Outer Shell:** `bg-[#111113]`, `ring-1 ring-white/[0.06]`, `p-1`, `rounded-2xl`
- **Inner Core:** `bg-[#18181B]`, `rounded-[calc(1rem-0.25rem)]`, overflow-hidden
- **Lumen Glow:** `shadow-[0_4px_24px_rgba({dynamicRgb},0.10)]` at rest, intensifies on hover

**Cover Image:**
- Aspect ratio `2/3` preserved
- Bottom gradient: `from-[#09090B] via-[#09090B]/70 to-transparent` — deeper fade than current
- Lumen bleed: subtle radial gradient at card bottom matching dynamic color at `opacity 0.08`

**Status Badge:**
- Pill shape `rounded-full`, `px-2.5 py-0.5`
- Background: semantic color at `90%` opacity
- Active statuses ("VIENDO", "LEYENDO"): add lumen glow `shadow-[0_0_12px_rgba({statusColor},0.30)]`
- Inactive statuses: no glow

**Rating Circle:**
- `w-8 h-8 rounded-full`, `bg-zinc-800/90`, `ring-1 ring-white/[0.08]`
- Lumen glow: `shadow-[0_0_8px_rgba({dynamicRgb},0.25)]`

**Progress Bar:**
- Track: `bg-white/10`, `h-1.5`, `rounded-full`
- Fill: dynamic color, `rounded-full`, no glow (kept clean)

**Quick Action "+" Button:**
- `bg-white`, `rounded-full`, dynamic color on icon
- Lumen glow: `shadow-[0_0_16px_rgba({dynamicRgb},0.25)]`
- Active: `scale-[0.95]` spring transition

**Season/Episode Metadata:**
- Pill: `bg-white/[0.08]`, `ring-1 ring-white/[0.05]`
- Mono font for numbers

### Cards (MediaCard — Detail View)

Same double-bezel architecture but larger:
- Outer: `rounded-[2rem]`, `p-1.5`
- Inner: `rounded-[calc(2rem-0.375rem)]`
- Lumen glow: stronger — `shadow-[0_8px_40px_rgba({dynamicRgb},0.15)]`

### Header (Desktop)

**Glass Pill — Floating, not stuck:**
- `mt-4 mx-auto w-max rounded-full`
- `bg-[#111113]/80`, `backdrop-blur-xl`, `ring-1 ring-white/[0.08]`
- Nav links inside: `rounded-full` pills, `px-4 py-2`
- Active link: `bg-white/[0.08]`, `text-white`
- Inactive: `text-zinc-400`, hover: `text-white`, `bg-white/[0.04]`

**Detail Mode Tint:**
- When viewing an item detail, bottom border gets: `shadow-[inset_0_-1px_0_rgba({dynamicRgb},0.15)]`

### Bottom Nav (Mobile)

- `bg-[#111113]/95`, `backdrop-blur-xl`
- `border-t border-white/[0.06]`
- Active icon: tinted with last-interacted work's dynamic color (or emerald as fallback)
- Center "+" button: `bg-white`, `rounded-full`, `-mt-8` elevated, `ring-4 ring-[#09090B]`
- "+" glow: `shadow-[0_0_16px_rgba(255,255,255,0.10)]`

### Login Screen

Already the best visual moment — refinements:
- Background blur: increase to `blur-[8px]`, scale to `scale-110`
- Avatar ring: `shadow-[0_0_20px_rgba(99,102,241,0.40)]`
- Input container: double-bezel — outer `ring-1 ring-white/[0.12]`, inner glass
- Unlock button: spring animation on success, `scale-[0.95]` on press
- Typography: larger heading `text-4xl`, tighter tracking

### Discovery Immersive View

- Background: full-bleed dynamic gradient from current card's color data
- 3D tilt: preserve existing logic
- Info sheet: glass panel `bg-[#111113]/90`, `backdrop-blur-2xl`, `ring-1 ring-white/[0.10]`
- Swipe cards: double-bezel at large scale, `rounded-[2rem]`
- Lumen glow on card: `shadow-[0_8px_48px_rgba({cardColor},0.20)]`

### Buttons (General)

- **Primary:** `bg-white text-zinc-900`, `rounded-full`, `px-6 py-3`, `font-bold`
- **Ghost:** `bg-transparent`, `ring-1 ring-white/[0.12]`, `text-zinc-300`
- **Active state:** `scale-[0.97]` with `transition-transform duration-150 ease-[cubic-bezier(0.32,0.72,0,1)]`
- **Hover state:** `bg-white/[0.04]` (ghost), slight translate on nested icons

### Inputs

- Label above, error below
- `bg-[#1C1C1F]`, `ring-1 ring-white/[0.08]`, `rounded-xl`, `px-4 py-3`
- Focus: `ring-white/[0.20]`, subtle lumen glow from context color
- No floating labels

### Toasts / Notifications

- `bg-[#111113]`, `ring-1 ring-white/[0.10]`, `rounded-xl`
- Success: left border `border-l-2 border-emerald-500`
- Error: left border `border-l-2 border-red-500`

### Empty States

Composed, illustrated compositions — not just "No data" text. Use contextual icon in a subtle circle with instructional text.

### Loading States

Skeletal shimmer matching exact layout dimensions. No circular spinners except the minimal password verifier.

## 5. Layout Principles

### Grid System

- Library grid: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6` (preserved)
- Max-width: `max-w-7xl mx-auto` (preserved)
- Section padding: `py-8 md:py-12` for views, more generous than current

### Spacing Philosophy

- Internal card padding: `p-4` minimum
- Section gaps: `gap-6 md:gap-8` between logical groups
- The app breathes — double the micro whitespace, keep the density where data lives

### Responsive

- **Mobile-first collapse (<768px):** All multi-column → single column
- Header collapses to top bar on mobile (simplified, no glass pill)
- Bottom nav: preserved with refinements
- Touch targets: minimum `44px`
- Typography scaling: `clamp()` for page titles

### Structural Rules

- No overlapping elements — every element in its own spatial zone
- `min-h-[100dvh]` for full-height, never `h-screen`
- `contain: layout style` on `<main>` preserved (performance)
- Cards use `contentVisibility: auto` preserved (performance)

## 6. Motion & Interaction

### Spring Physics Default

All transitions use custom cubic-bezier instead of `ease-in-out`:

```
--spring: cubic-bezier(0.32, 0.72, 0, 1);
--spring-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
```

**Duration scale:**
- Micro (hover, press): `150ms`
- Standard (expand, collapse): `300ms`
- Expressive (page enter, modal): `500ms`
- Cinematic (login reveal, immersive transition): `800ms`

### Staggered Cascade Reveals

Cards never appear all at once. On library mount or filter change:
- Each card fades up with staggered delay: `delay-[${index * 50}ms]`
- Transform: `translate-y-4 opacity-0` → `translate-y-0 opacity-100`
- Duration: `400ms`, spring easing

### Micro-Interactions

- **Button press:** `active:scale-[0.97]` with spring 150ms
- **Favorite star:** `scale-110` bounce on toggle, then settle
- **Quick action "+1":** ripple + counter increment animation
- **Delete:** `scale-[0.95] opacity-0` exit before removal
- **Card hover (desktop):** `scale-[1.02]` + lumen glow intensify

### Scroll Behavior

- Scroll-to-top: `behavior: smooth` (preserved)
- Entry animations via IntersectionObserver (preserved — already implemented)
- No scroll-linked layout shifts

### Performance Rules

- Animate ONLY `transform` and `opacity` — never `top`, `left`, `width`, `height`
- `will-change: transform` only on actively animating elements
- `backdrop-blur` only on fixed/sticky elements (header, bottom nav, modals, overlays)
- Lumen glow (`box-shadow`) does NOT trigger layout — safe to animate opacity
- Grain/noise: NOT used (keeps performance budget clean)

## 7. Anti-Patterns (Banned)

- ❌ No emojis in UI chrome
- ❌ No Inter, Roboto, or system fonts as primary
- ❌ No pure black `#000000` — always Void Black `#09090B`
- ❌ No Slate grays (blue undertone) — Zinc only
- ❌ No neon text-shadow, neon outlines, neon border glow
- ❌ No gradient text on large headers
- ❌ No more than one lumen glow per card at rest
- ❌ No `ease-in-out` or `linear` transitions — spring physics only
- ❌ No 3-column equal Bootstrap grids without whitespace breaks
- ❌ No generic placeholder names ("John Doe", "Acme")
- ❌ No AI copywriting clichés ("Elevate", "Seamless", "Unleash", "Next-Gen")
- ❌ No filler UI text: "Scroll to explore", bouncing chevrons
- ❌ No `h-screen` — always `min-h-[100dvh]`
- ❌ No `backdrop-blur` on scrolling containers
- ❌ No thick-stroked icons — use Lucide at `stroke-width: 1.5` or switch to Phosphor Light

## 8. Implementation Priority

Phase 1 — Foundation (non-breaking, global):
1. Install & configure Geist font
2. Replace Slate → Zinc across all components
3. Update CSS variables & Tailwind config
4. Update `styles.css` with new neutrals + scrollbar

Phase 2 — Core Components:
5. CompactMediaCard: double-bezel + lumen glow + refined gradient
6. MediaCard (detail): double-bezel + stronger lumen
7. Header: glass pill floating layout
8. Bottom Nav: glass + refined "+" button

Phase 3 — Views:
9. Login Screen: refinements (blur, typography, spring)
10. Discovery Immersive: glass info sheet + enhanced lumen
11. Library/Catalog view: stagger reveal animation
12. Stats view: mono numbers + refined cards

Phase 4 — Polish:
13. Micro-interactions (favorite, +1, delete)
14. Spring transitions everywhere
15. ContextualGreeting typography refinement
16. Final audit & responsive testing
