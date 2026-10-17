# Live Lightly Design System

Riso Zine aesthetic: misregistered duotone type, ink borders, tape patterns, stamp cards, grain texture overlay, tilted cards, torn edges, cut corners.

## Palette

### Brand tokens

| Token       | Hex       | Usage                                    |
|-------------|-----------|------------------------------------------|
| `--coral`   | `#E24B3A` | Primary accent, display type, CTA        |
| `--teal`    | `#0B6E6F` | Secondary accent, links                  |
| `--overprint`| `#7A4A38`| Tertiary                                 |
| `--paper`   | `#F2EBD9` | Page background (cream paper)            |
| `--ink`     | `#2D2926` | Body text, borders                       |
| `--faded`   | `#9A9183` | Secondary text, muted UI                 |
| `--buff`    | `#E8DFC8` | Subtle backgrounds, dividers, shadows    |

### Category colors (each category has a distinct color)

| Category         | CSS Variable         | Hex       |
|------------------|----------------------|-----------|
| Transit          | `var(--cat-transit)` | `#0B6E6F` |
| Active Mobility  | `var(--cat-mobility)`| `#B5604E` |
| Daily Needs      | `var(--cat-daily)`   | `#8B6D2E` |
| Circular Economy | `var(--cat-circular)`| `#6B5B95` |
| Local Food       | `var(--cat-food)`    | `#3A7D44` |

### Score ramp (separate from category colors)

| Band              | CSS Variable           | Hex       |
|-------------------|------------------------|-----------|
| 0-24 Underserved  | `var(--score-low)`     | `#C0392B` |
| 25-49 Limited     | `var(--score-mid)`     | `#B5604E` |
| 50-74 Moderate    | `var(--score-high)`    | `#2D8A8B` |
| 75-100 Excellent  | `var(--score-excellent)`| `#1A6B4B` |

Dark mode redefines all tokens under `@media (prefers-color-scheme: dark)` and `[data-theme="dark"]` in `globals.css`.

## Typography

| Role           | Font         | Weight    | Tailwind class                   |
|----------------|-------------|-----------|-----------------------------------|
| Display/brand  | Syne        | 800       | `font-display font-extrabold`     |
| Section heads  | Syne        | 700       | `font-display font-bold`          |
| Body mono      | Space Mono  | 400       | `font-body` (default)             |
| Body readable  | Inter       | 400-600   | `font-text`                       |

Custom sizes in `tailwind.config.ts` (all updated to meet 14px minimum for body text):

- `text-score-hero` (7.5rem): Score numeral on results page
- `text-title-xl` (3.2rem): Page titles
- `text-section` (0.875rem / 14px): Section headers (uppercase, tracked)
- `text-label` (0.8125rem / 13px): Labels and sub-heads
- `text-body-base` (1rem / 16px): Standard body copy
- `text-body-sm` (0.875rem / 14px): Secondary body text
- `text-tag` (0.75rem / 12px): Tags, badges, legend text

## Architecture

Single-page flow: home and results live in `app/page.tsx`. URL param `?address=` switches between `LandingView` and `ResultsView` via `useSearchParams()` + `<Suspense>`. The old `/results/[address]` route redirects to `/?address=`.

## Component Conventions

### Misregistered Type
Apply `misregister` class with `data-text` attribute. The `::before` pseudo-element renders a teal offset shadow. Used on brand title and score numeral.

### Borders and Containers
- Solid: `border border-ink` (cards, tables, map containers)
- Dashed: `border border-dashed border-faded` (callout boxes, limitations)
- Tape: `tape-border` (dashed ink border, zine feel)
- Section dividers: `border-b-2 border-ink` (nav, section heads)
- Row dividers: `divide-y divide-dashed divide-buff`

### Shadows
Riso-style offset: `shadow-[3px_3px_0_var(--buff)]`

### Grain Texture
Apply `grain` class for SVG noise overlay via `::after` pseudo-element with `mix-blend-mode: multiply`.

### Zine Layout Classes
- `zine-tilt-1` / `zine-tilt-2` / `zine-tilt-3`: Slight rotation offsets for hand-placed feel
- `cut-corner`: Clip-path removing top-right corner
- `torn-edge`: Dashed bottom edge via `::after` pseudo-element
- `pull-quote`: Left coral border with italic styling

### Map Markers
Each category has a distinct SVG marker shape:
- Transit: Square
- Active Mobility: Diamond
- Daily Needs: Circle
- Circular Economy: Triangle
- Local Food: Pentagon

Home marker: Large coral pin with white center.

### Mapbox Basemap
Programmatic customization of `light-v11` to match cream paper palette: paper background, teal water, muted parks, warm buildings. Applied via `applyBrandBasemap()`.

### SVG Icons
Each scoring category has a hand-drawn SVG icon component accepting a `size` prop. Icons use CSS variable colors. Located inline in `app/page.tsx`.

### Persistent Nav
Sticky top nav (`border-b-2 border-ink bg-paper sticky top-0 z-50`) with "Add to the Map" as bordered button. Consistent across all pages. Mobile hamburger on landing page.

## Lighthouse

| Metric        | Phase 1 Baseline | Phase 2 (current) |
|---------------|------------------|--------------------|
| Performance   | 71               | 98                 |
| Accessibility | 98               | 98                 |

Measured on production build (`next build` + `next start`) of the landing page.
