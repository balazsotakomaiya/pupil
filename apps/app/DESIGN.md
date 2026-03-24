# Pupil Desktop App — Design Language

A living reference for the Pupil desktop app UI. This document captures the current design direction as established by the dashboard PoC — it's a starting point, not a specification. Expect it to evolve as new screens are built and better patterns emerge.

When in doubt, use what's here. When something isn't working, change it and update this doc.

---

## Where This Comes From

The desktop app inherits the visual identity of the Vigil site (`apps/site`): same color palette, font stack, border tokens, and ruler motif. The dashboard PoC adapted that foundation for a desktop context, which introduced several departures that should carry forward unless a better approach presents itself:

- **Titlebar instead of navbar.** A Tauri-draggable bar with inline tabs replaces the site's sticky nav.
- **No footer.** Bottom breathing room is just a spacer.
- **Full-width horizontal rulers.** Section dividers bleed to viewport edges.
- **Study CTA as hero.** The primary action dominates the top of the dashboard.
- **No Instrument Serif.** The italic credit font has no current role in the app.

These aren't sacred — they're the choices that made sense for the first screen. If a future screen needs a sidebar, a different nav pattern, or a footer, that's fine. Update this doc when you do.

---

## Fonts

Currently loaded via Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Syne:wght@700&display=swap" rel="stylesheet">
```

| Role | Family | Weight | Where it's used now |
|---|---|---|---|
| Body / UI | Inter | 400, 500, 600, 700 | All body text, buttons, descriptions, card content |
| Code / data | JetBrains Mono | 400, 500 | Eyebrow labels, timestamps, source tags, streaks, stat deltas |
| Logo wordmark | Syne | 700 | "pupil" in the titlebar |

```css
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: "JetBrains Mono", "SF Mono", "Fira Code", monospace;
```

The current convention: JetBrains Mono signals "data" — measurements, labels, timestamps, machine-readable identifiers. Inter is for anything a human reads as prose. This split has worked well so far but isn't a hard boundary.

---

## Color Palette

Dark theme only for now. No light mode planned for Phase 1.

```css
/* Backgrounds — three elevation tiers */
--bg:          #0a0a0a;   /* page / window background — near black */
--bg-subtle:   #111;      /* cards, panels, table rows */
--bg-elevated: #161616;   /* raised surfaces: active tabs, header rows, hover states */

/* Borders */
--border:       #1e1e1e;  /* default border on cards and dividers */
--border-hover: #333;     /* border on hover / focus */
--ruler:        #2a2a2a;  /* dotted ruler overlay lines */

/* Text — three tiers */
--text-primary:   #ededed;  /* headings, values, active nav, emphasis */
--text-secondary: #888;     /* descriptions, paragraph text, inactive links */
--text-tertiary:  #555;     /* labels, placeholders, eyebrows, faded metadata */

/* Accent — intentionally monochrome */
--accent: #ededed;  /* same as text-primary; no colored accent */

/* Semantic */
--success:     #10b981;    /* emerald green — currently the only chromatic color */
--success-dim: #10b98115;  /* green at ~8% opacity for backgrounds */
```

The palette is deliberately monochrome right now. `#10b981` is the only chromatic color, used for active streak dots, due-card indicators, today's streak cell, and positive stat deltas. The constraint is intentional — it gives the UI a distinctive character — but it's a design choice, not a commandment. If a screen genuinely needs a warning color, an error state, or a different semantic color, introduce it thoughtfully and document it here.

Hover highlight backgrounds currently use `rgba(255, 255, 255, 0.03)` or `0.04` — barely perceptible. That subtlety has been working.

---

## Spacing & Layout

```css
--radius:    8px;   /* buttons, inputs, small elements */
--radius-lg: 12px;  /* cards, panels, stat blocks */
```

Current values from the dashboard:

| Token | Value |
|---|---|
| Content max-width | `960px` |
| Page horizontal padding | `32px` (under 640px: `20px`) |
| Titlebar height | `52px` |
| Titlebar horizontal padding | `20px` (under 640px: `12px`) |
| Study CTA section padding | `56px 0 48px` |
| Standard section padding | `40px 0` |
| Card padding | `24px` (study CTA: `36px 40px`) |
| Section head margin-bottom | `20px` |
| Grid gap (cards, stats) | `12px` |
| Bottom page spacer | `64px` |

These emerged from the dashboard layout. Other screens may need different rhythms — the important thing is consistency within a screen, not rigid adherence to these exact numbers.

---

## Typography Scale

What's been established so far:

### Study CTA headline (largest text in the dashboard)
```css
font-size: clamp(24px, 3vw, 36px);
font-weight: 600;
letter-spacing: -0.8px;
line-height: 1.15;
```

### Stat value
```css
font-size: 32px;
font-weight: 700;
letter-spacing: -1px;
line-height: 1;
```

### Stat unit (inline with stat value)
```css
font-size: 14px;
font-weight: 500;
color: var(--text-tertiary);
```

### Section label (eyebrow)
```css
font-family: var(--font-mono);
font-size: 12px;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 1.5px;
color: var(--text-tertiary);
```

### Card title (space name, panel title)
```css
font-size: 15px;
font-weight: 600;
letter-spacing: -0.2px;
color: var(--text-primary);
```

### Card description
```css
font-size: 13px;
line-height: 1.5;
color: var(--text-secondary);
```

### Body / description
```css
font-size: 14–15px;
line-height: 1.5;
color: var(--text-secondary);
```

### Titlebar logo
```css
font-family: "Syne", var(--font-sans);
font-size: 17px;
font-weight: 700;
letter-spacing: -0.5px;
```

### Titlebar tab
```css
font-size: 12.5px;
font-weight: 500;
/* inactive: text-tertiary, no bg */
/* active: text-primary, bg-elevated */
```

### Mono metadata (source tags, timestamps, streak counts)
```css
font-family: var(--font-mono);
font-size: 10–12px;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 0.3–1.5px;
color: var(--text-tertiary);
```

### Positive delta
```css
color: var(--success);
font-family: var(--font-mono);
font-size: 11px;
font-weight: 500;
```

New screens will likely need sizes or weights not listed here. The general direction is: tight negative letter-spacing on large text, loose uppercase mono for labels, Inter 13–15px for readable content.

---

## Dotted Rulers

The visual signature of the app, inherited from the site. Currently implemented as six fixed rulers framing the viewport plus full-width section dividers.

```css
--ruler: #2a2a2a;

/* Vertical dashes (top to bottom) */
background-image: repeating-linear-gradient(
  to bottom,
  var(--ruler) 0px, var(--ruler) 1px,
  transparent 1px, transparent 5px
);

/* Horizontal dashes (left to right) */
background-image: repeating-linear-gradient(
  to right,
  var(--ruler) 0px, var(--ruler) 1px,
  transparent 1px, transparent 5px
);
```

### Fixed rulers (current setup: 6 lines)

All `position: fixed`, `pointer-events: none`, `z-index: 50`, inside an `overflow: hidden` container at `inset: 0`.

| Ruler | Position |
|---|---|
| Outer left | `left: 0` |
| Outer right | `right: 0` |
| Content left | `left: max(32px, calc((100vw - 960px) / 2))` |
| Content right | `right: max(32px, calc((100vw - 960px) / 2))` |
| Top | `top: 0`, full width |
| Bottom | `bottom: 0`, full width |

### Section dividers

```css
.ruler-divider {
  height: 1px;
  margin-left: calc(-50vw + 50%);
  margin-right: calc(-50vw + 50%);
  /* same horizontal dash pattern */
}
```

The negative margins bleed dividers to the viewport edges. Place one between major sections. If a screen doesn't need them (e.g., a focused study view), leave them out — the rulers are structural punctuation, not mandatory furniture.

---

## Titlebar

The current approach to desktop navigation. The whole bar is a Tauri drag region; interactive children opt out.

```css
.titlebar {
  height: 52px;
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(10, 10, 10, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  -webkit-app-region: drag;
  user-select: none;
}
```

**Layout:** Logo → separator → tabs on the left. Action buttons on the right.

| Element | Current spec |
|---|---|
| Logo | Eye SVG 24×24 + "pupil" Syne 17px, gap `7px` |
| Separator | `1px × 18px`, `background: var(--border)` |
| Tabs | Flat, `gap: 2px`, `padding: 5px 11px`, `border-radius: 5px` |
| Buttons | `30px` height, `border-radius: 6px`, `1px solid var(--border)` |

Tab states: inactive `text-tertiary` → hover `text-secondary` → active `text-primary` on `bg-elevated`.

Interactive elements need `-webkit-app-region: no-drag`.

This pattern works well for a flat page with tab-based navigation. Screens that need deeper hierarchy (e.g., space detail with sub-tabs) may evolve the titlebar or introduce secondary navigation — that's expected.

---

## Logo — Animated Eye

SVG, 52×52 viewBox, rendered at 24×24 in the titlebar. Four animated layers on a shared `4s ease-in-out infinite` cycle.

| Layer | Animation |
|---|---|
| Eye outline (`<path>`) | `d:` morphs from almond to slit — double blink at ~18.5% and ~36.5% |
| Iris ring (`<circle r="9">`, stroke) | `scaleY(0.1)` + `opacity: 0` during blink |
| Pupil group (`<g>`) | `scaleY(0)` + `opacity: 0` during blink |
| Pupil fill (`<circle r="3.5">`) | `translateX(±3px)` drift between blinks |

```css
/* Open */
d: path("M 2 26 C 12 10, 40 10, 50 26 C 40 42, 12 42, 2 26 Z");
/* Closed */
d: path("M 2 26 C 12 23, 40 23, 50 26 C 40 29, 12 29, 2 26 Z");
```

All `transform-origin`: `26px 26px`. Stroke: `#ededed`. Outline stroke-width `2.8`, iris `2`, pupil is filled.

---

## Buttons

Three tiers established so far:

### Primary (filled)

Currently used only for the main study action. White on dark — the single highest-contrast element on screen.

```css
font-size: 14px; font-weight: 600;
color: var(--bg); background: var(--text-primary);
border: none; border-radius: var(--radius); padding: 12px 28px;
letter-spacing: -0.2px;
/* hover: opacity 0.85 */
```

The current convention is one filled button per screen. This keeps the visual weight focused on the primary action. Worth preserving unless there's a good reason to break it.

### Secondary (ghost outline)

```css
font-size: 13px; font-weight: 500;
color: var(--text-secondary); background: transparent;
border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 18px;
/* hover: text-primary, border-hover, rgba(255,255,255,0.03) */
```

### Ghost (section actions)

```css
font-size: 13px; font-weight: 500;
color: var(--text-secondary); padding: 6px 14px;
border-radius: 6px; border: 1px solid var(--border); background: transparent;
/* hover: text-primary, border-hover, rgba(255,255,255,0.04) */
/* icon: 14×14, opacity 0.5 */
```

---

## Cards

### Standard card

The workhorse surface. Used for space cards, stat blocks, streak panel, activity panel.

```css
background: var(--bg-subtle);
border: 1px solid var(--border);
border-radius: var(--radius-lg);
padding: 24px;
transition: border-color 0.2s, background 0.2s;
/* hover (interactive): border-hover, bg-elevated */
```

### Study CTA card

Same base, larger padding (`36px 40px`), contains the study prompt.

### Internal divider

`border-top: 1px solid var(--border); padding-top: 16px;` — used to separate metadata from card body.

---

## Data Table

Currently used for the activity list. A card with `overflow: hidden` and a distinct header.

**Header:** `bg-elevated`, `border-bottom`, title (13px/600, `text-secondary`), optional action link (12px, `text-tertiary`).

**Rows:** Grid `64px 1fr auto`, padding `11px 20px`, `border-bottom` between rows, hover `bg-elevated`.

| Column | Current style |
|---|---|
| Timestamp | Mono 11px, `text-tertiary` |
| Description | Inter 13px, `text-secondary`, `<strong>` in `text-primary` |
| Type | Mono 10px, uppercase, `text-tertiary` |

This pattern should adapt naturally to other tabular data — card lists, import logs, review history.

---

## Streak Calendar

GitHub-contribution-graph style, currently 16 weeks × 7 days.

```css
display: grid;
grid-template-columns: repeat(16, 1fr);
grid-template-rows: repeat(7, 1fr);
gap: 3px;
grid-auto-flow: column;
```

Cell states:

| State | Background | Border |
|---|---|---|
| Empty | `var(--bg-elevated)` | `transparent` |
| Studied | `#ededed18` | `#ededed25` |
| Today (not studied) | `var(--bg-elevated)` | `var(--text-tertiary)` |
| Today (studied) | `var(--success-dim)` | `var(--success)` |

Cells: `aspect-ratio: 1`, `border-radius: 3px`.

---

## Section Structure

The dashboard uses a repeating formula that works well for content-heavy pages:

1. Full-width ruler divider
2. Section with vertical padding (`40px 0`)
3. Section head: mono eyebrow label on the left, optional ghost action on the right
4. Content
5. Full-width ruler divider

This isn't mandatory for every screen. A study session view, a modal, or a settings form will have different rhythms. The formula is a useful default, not a requirement.

---

## Status Indicators

Three sizes of dot, all using `var(--success)`:

| Indicator | Size | Animation | Where |
|---|---|---|---|
| Live dot | `6px` | Pulse (opacity 1 → 0.3, 2.5s) | Study CTA eyebrow |
| Streak dot | `5px` | None | Space card streak badge |
| Due dot | `4px` | None | Inline with due count |

---

## Borders & Radii

**Borders** — all `1px solid`:

| State | Color |
|---|---|
| Default | `#1e1e1e` |
| Hover | `#333` |
| Rulers | `#2a2a2a` (dashed, not solid) |

**Radii:**

| Context | Value |
|---|---|
| Cards, panels | `12px` |
| Buttons, tabs | `5–8px` |
| Streak cells | `3px` |
| Dots | `50%` |

---

## Transitions

| What | Duration |
|---|---|
| Color, border-color | `0.15s` |
| Background | `0.15s–0.2s` |
| Card hover (combined) | `0.2s` |

---

## Animations

Currently only two:

- **Eye blink** — `4s ease-in-out infinite`, double blink + pupil drift. See Logo section.
- **Pulse** — `2.5s ease-in-out infinite`, opacity oscillation. Used for the study CTA live dot.

No entrance animations, page transitions, or loading skeletons yet. These can be added as the app matures — the current aesthetic leans on stillness, but that may change.

---

## Scrollbar

```css
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--border-hover); }
```

---

## Icons

Inline SVGs, `stroke="currentColor"`, `fill="none"`, `stroke-width="1.5"` (or `1.8` at smaller sizes). Color inherits from parent.

| Context | Size |
|---|---|
| Titlebar buttons | `14×14` |
| Ghost button icons | `14×14`, `opacity: 0.5` |
| Labeled button icons | `13×13`, `opacity: 0.5` |

No icon library — hand-authored paths so far. If the icon count grows significantly, adopting a consistent set (Lucide, Phosphor, etc.) is reasonable.

---

## Responsive

The app runs in a Tauri window but handles narrow viewports for resized windows and a potential web build.

| Breakpoint | Current behavior |
|---|---|
| `≤ 768px` | Space grid → 1 col; stats → 2 col; bottom grid stacks; study CTA stacks vertically |
| `≤ 640px` | Tighter page + titlebar padding; smaller tab text; stats → 2 col |

---

## Global Resets

```css
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html { scroll-behavior: smooth; }

body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  line-height: 1.5;
  overflow-x: hidden;
}
```

---

## Building a New Screen

A rough checklist to get started. Deviate as needed.

1. **Fonts** — Inter 400–700, JetBrains Mono 400–500, Syne 700
2. **CSS variables** — copy the `:root` block from above
3. **Global reset** — margin/padding/box-sizing + font-smoothing
4. **Ruler overlay** — 4 vertical + 2 horizontal dashed lines, fixed, `pointer-events: none`
5. **Titlebar** — 52px sticky, frosted glass, drag region
6. **Content column** — `max-width: 960px`, `margin: 0 auto`, `padding: 0 32px`
7. **Section formula** — ruler divider → padding → mono eyebrow → content → divider
8. **Cards** — `#111` background, `1px solid #1e1e1e`, `12px` radius
9. **Primary action** — one filled button per screen for the most important thing
10. **Color restraint** — `#10b981` for success/progress indicators, monochrome for everything else
11. **Transitions** — `0.15s` for color, `0.2s` for background

None of these are absolute. The goal is a coherent product, not pixel-perfect compliance with a spec. If something looks or feels wrong, trust that instinct and iterate.