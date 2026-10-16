# Live Lightly Design System

Riso Zine aesthetic: misregistered duotone type, ink borders, tape patterns, stamp cards, grain texture overlay.

## Palette

| Token       | Hex       | Usage                                    |
|-------------|-----------|------------------------------------------|
| `--coral`   | `#E24B3A` | Primary accent, display type, CTA        |
| `--teal`    | `#0B6E6F` | Secondary accent, links, high scores     |
| `--overprint`| `#7A4A38`| Tertiary, mid-range scores, active mobility/local food |
| `--paper`   | `#F2EBD9` | Page background                          |
| `--ink`     | `#2D2926` | Body text, borders                       |
| `--faded`   | `#9A9183` | Secondary text, muted UI                 |
| `--buff`    | `#E8DFC8` | Subtle backgrounds, dividers, shadows    |

Dark mode redefines these tokens under `@media (prefers-color-scheme: dark)` and `[data-theme="dark"]` in `globals.css`.

## Typography

| Role         | Font         | Weight | Tailwind class     |
|--------------|-------------|--------|--------------------|
| Display/brand| Syne        | 800    | `font-display font-extrabold` |
| Section heads| Syne        | 700    | `font-display font-bold` |
| Body/mono    | Space Mono  | 400    | `font-body` (default) |
| Body bold    | Space Mono  | 700    | `font-bold`        |

Custom sizes in `tailwind.config.ts`:

- `text-score-hero` (7.5rem): Score numeral on results page
- `text-title-xl` (3.2rem): Page titles
- `text-section` (0.72rem): Section headers (uppercase, tracked)
- `text-label` (0.6rem): Labels and sub-heads
- `text-body-sm` (0.62rem): Body text
- `text-tag` (0.58rem): Tags, badges, legend text

## Component Conventions

### Misregistered Type
Apply `misregister` class with `data-text` attribute. The `::before` pseudo-element renders a teal offset shadow. Used on brand title and score numeral.

### Borders and Containers
- Solid: `border border-ink` (cards, tables, map containers)
- Dashed: `border border-dashed border-faded` (callout boxes, limitations)
- Section dividers: `border-b-2 border-ink` (nav, section heads)
- Row dividers: `divide-y divide-dashed divide-buff`

### Shadows
Riso-style offset: `shadow-[3px_3px_0_var(--buff)]`

### Grain Texture
Apply `grain` class for SVG noise overlay via `::after` pseudo-element with `mix-blend-mode: multiply`.

### Score Colors
Category fills map to palette tokens:

| Category         | Color variable    |
|------------------|-------------------|
| Transit          | `var(--teal)`     |
| Active Mobility  | `var(--overprint)`|
| Daily Needs      | `var(--coral)`    |
| Circular Economy | `var(--teal)`     |
| Local Food       | `var(--overprint)`|

Score tiers: 75+ = teal (Excellent), 50+ = overprint (Moderate), 25+ = coral (Limited), <25 = coral (Severely underserved).

### SVG Icons
Each scoring category has a hand-drawn SVG icon component accepting a `size` prop. Icons use CSS variable colors from the palette. Located inline in `app/results/[address]/page.tsx`.

## Lighthouse Baseline

| Metric         | Before Phase 1 | After Phase 1 |
|----------------|---------------|---------------|
| Performance    | 71            | 70            |
| Accessibility  | 96            | 98            |
