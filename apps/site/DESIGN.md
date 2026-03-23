# Vigil Site — Design Language

A reference for replicating or extending the site's visual identity. Everything here is sourced directly from `src/style.css`, `src/App.tsx`, and `index.html`.

---

## Fonts

Loaded via Google Fonts (see `index.html`):

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Syne:wght@700&family=Instrument+Serif:ital@1&display=swap" rel="stylesheet" />
```

| Role | Family | Weight | Notes |
|---|---|---|---|
| Body / UI | Inter | 400, 500, 600, 700 | Fallback: `-apple-system, BlinkMacSystemFont, sans-serif` |
| Code / mono | JetBrains Mono | 400, 500 | Fallback: `"SF Mono", "Fira Code", monospace` |
| Logo wordmark | Syne | 700 | Used for "vigil" in nav and footer only |
| Italic credit | Instrument Serif | italic | Used for the author credit link in footer |

CSS variables:

```css
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: "JetBrains Mono", "SF Mono", "Fira Code", monospace;
```

---

## Color Palette

All dark theme. No light mode.

```css
/* Backgrounds */
--bg:          #0a0a0a;  /* page background — near black */
--bg-subtle:   #111;     /* cards, alternate sections */
--bg-elevated: #161616;  /* raised surfaces, active tabs */
--code-bg:     #0f0f0f;  /* code block background */

/* Borders */
--border:       #1e1e1e;  /* default border */
--border-hover: #333;     /* border on hover */
--ruler:        #2a2a2a;  /* dotted ruler lines */

/* Text */
--text-primary:   #ededed;  /* headings, body, icons */
--text-secondary: #888;     /* descriptions, nav links */
--text-tertiary:  #555;     /* labels, placeholders, faded UI */

/* Accent */
--accent: #ededed;  /* same as text-primary; no coloured accent */
```

One-off semantic colors used directly (not via CSS variables):

| Use | Value |
|---|---|
| Vigil "Built-in" check in comparison table | `#10b981` (emerald green) |
| Code getter highlight (`.state-info-value--getter`) | `#61afef` (blue) |

Syntax highlighting (Shiki theme `one-dark-pro`, also manual `.hl-*` classes):

| Token | Color |
|---|---|
| Keyword | `#c678dd` |
| String | `#98c379` |
| Comment | `#5c6370` italic |
| Function | `#61afef` |
| Type | `#e5c07b` |
| Number | `#d19a66` |
| Default code text | `#8b8b8b` |

---

## Spacing & Layout

```css
--radius:    8px;   /* standard border-radius */
--radius-lg: 12px;  /* large cards */
```

| Token | Value |
|---|---|
| Page horizontal padding | `32px` (mobile: `20px`) |
| Content max-width | `960px` |
| Hero max-width | `720px` |
| Section vertical padding | `80px 32px` (mobile: `56px 20px`) |
| Hero padding | `96px 32px 80px` (mobile: `64px 20px 56px`) |
| Nav padding | `16px 32px` (mobile: `12px 16px`) |
| Feature card padding | `24px` |
| Section title margin-bottom | `12px` |
| Section desc margin-bottom | `48px` |

---

## Typography Scale

### Hero title
```css
font-size: clamp(36px, 5vw, 56px);
font-weight: 600;
line-height: 1.1;
letter-spacing: -1.5px;
```

### Section title
```css
font-size: clamp(24px, 3vw, 36px);
font-weight: 600;
letter-spacing: -0.8px;
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

### Body / description
```css
font-size: 15–16px;
line-height: 1.6;
color: var(--text-secondary);
```

### Nav logo
```css
font-family: "Syne", var(--font-sans);
font-size: 26px;
font-weight: 700;
letter-spacing: -0.5px;
```

### Small card / feature text
```css
/* title */ font-size: 15px; font-weight: 600;
/* desc  */ font-size: 13px; line-height: 1.5; color: var(--text-secondary);
```

### Code in prose
```css
font-family: var(--font-mono);
font-size: 13px;
background: var(--bg-subtle);
padding: 2px 6px;
border-radius: 4px;
border: 1px solid var(--border);
```

---

## Dotted Rulers

The defining structural motif of the layout. Four vertical rulers + top/bottom horizontal rulers form a "blueprint grid" overlay. Section dividers use the same dash pattern horizontally.

```css
/* CSS variable */
--ruler: #2a2a2a;

/* Vertical ruler — dashes running top-to-bottom */
background-image: repeating-linear-gradient(
  to bottom,
  var(--ruler) 0px,
  var(--ruler) 1px,
  transparent 1px,
  transparent 5px   /* 1px dash, 4px gap → 20% fill */
);

/* Horizontal ruler — dashes running left-to-right */
background-image: repeating-linear-gradient(
  to right,
  var(--ruler) 0px,
  var(--ruler) 1px,
  transparent 1px,
  transparent 5px
);
```

Ruler positions:
- **Outer left** — `left: 0`, 1px wide
- **Outer right** — `right: 0`, 1px wide
- **Content left** — `left: max(32px, calc((100vw - 960px) / 2))` — aligns with content column edge
- **Content right** — `right: max(32px, calc((100vw - 960px) / 2))`
- **Top / Bottom** — full-width horizontal lines at `top: 0` and `bottom: 0`
- **Section dividers** — full-width `<div class="ruler-divider" />` between sections

All rulers are `position: fixed`, `pointer-events: none`, `z-index: 50`, and use `overflow: hidden`.

---

## Navigation

Sticky, frosted-glass bar:

```css
position: sticky;
top: 0;
z-index: 100;
background: rgba(10, 10, 10, 0.8);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
border-bottom: 1px solid var(--border);
```

- Logo: Syne 700, 26px, `letter-spacing: -0.5px`, with animated SVG eye
- Nav links: Inter 13px, `color: var(--text-secondary)`, hover → `var(--text-primary)`, `transition: color 0.15s`
- GitHub button: pill shape (`border-radius: 6px`), `border: 1px solid var(--border)`, hover gets `background: rgba(255,255,255,0.04)`

---

## Logo — Animated Eye

SVG 52×52 viewBox. Four animated layers:

| Layer | Class | Animation |
|---|---|---|
| Eye outline (lens/almond shape) | `.vigil-eye-shape` | `vigil-blink` — squishes to a slit at 18.5s and 36.5s marks |
| Iris circle | `.vigil-eye-iris` | `vigil-iris` — `scaleY(0.1)` hidden during blink |
| Pupil group | `.vigil-eye-pupil-group` | `vigil-pupil-hide` — fully hidden during blink |
| Pupil fill | `.vigil-eye-pupil` | `vigil-look` — translateX ±3.5px side-to-side look |

All animations share a 4s duration, `ease-in-out`, `infinite`. Double blink at 18.5–21.5s and 36.5–39.5s.

---

## Border Radii

| Context | Value |
|---|---|
| Standard card, tab panel, code block | `var(--radius)` = `8px` |
| Large card (feature card, state demo, usage card) | `var(--radius-lg)` = `12px` |
| Pill badge, version chip | `999px` |
| Small button, inline tag | `6px` or `4px` |
| Phone mockup body | `20px` |
| Phone mockup screen | `12px` |
| Spinner | `50%` |

---

## Borders

All borders are `1px solid`:

| State | Color |
|---|---|
| Default | `var(--border)` = `#1e1e1e` |
| Hover | `var(--border-hover)` = `#333` |
| Active tab / selected pattern | `var(--text-tertiary)` = `#555` |
| Phone mockup | `var(--border-hover)` = `#333`, 2px |

---

## Buttons & Interactive Elements

### Tab buttons (pkg manager, usage, state scenario)
```css
font-family: var(--font-mono);  /* or font-sans for scenario tabs */
font-size: 12–13px;
color: var(--text-tertiary);
background: transparent;
border: none;
transition: color 0.15s, background 0.15s;

/* active */
color: var(--text-primary);
background: var(--bg-elevated);
```

### Pattern nav buttons (sidebar)
```css
background: var(--bg-subtle);
border: 1px solid var(--border);
border-radius: var(--radius);
padding: 16px;
transition: border-color 0.2s, background 0.2s;

/* active */
border-color: var(--text-tertiary);
background: var(--bg-elevated);
```

### Copy button (code blocks)
```css
position: absolute;
top: 12px; right: 12px;
background: var(--bg-elevated);
border: 1px solid var(--border);
color: var(--text-tertiary);
border-radius: 6px;
padding: 6px;
transition: color 0.15s, border-color 0.15s, background 0.15s;
```

All transition durations: `0.15s` for color/border, `0.2s` for background on cards.

---

## Cards

```css
/* Feature card */
background: var(--bg-subtle);
border: 1px solid var(--border);
border-radius: var(--radius-lg);   /* 12px */
padding: 24px;
transition: border-color 0.2s;

/* hover */
border-color: var(--border-hover);
```

Feature icon container: `40×40px`, `color: var(--text-primary)`, no background.

---

## Hero Badge

```css
display: inline-flex;
align-items: center;
gap: 10px;
font-size: 12px;
font-weight: 500;
color: var(--text-secondary);
border: 1px solid var(--border);
border-radius: 999px;    /* pill */
padding: 5px 14px;
margin-bottom: 24px;
letter-spacing: 0.2px;
```

Version chip inside badge:
```css
font-family: var(--font-mono);
font-size: 11px;
color: var(--text-tertiary);
background: var(--bg-elevated);
padding: 2px 8px;
border-radius: 999px;
```

---

## Code Blocks

Syntax highlighted via Shiki (`one-dark-pro` theme). Background is transparent; container provides the surface color.

```css
.code-block {
  padding: 20px;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.7;
  color: #8b8b8b;   /* fallback for non-highlighted */
  overflow-x: auto;
  background: transparent !important;
}
```

Wrapper `.code-block-wrap` is `position: relative` to anchor the copy button.

---

## Phone Mockup (State Demo)

```css
width: 140px;
height: 240px;
background: var(--bg);
border: 2px solid var(--border-hover);  /* #333 */
border-radius: 20px;
padding: 12px;

/* Notch (::before) */
width: 40px; height: 4px;
background: var(--border);
border-radius: 2px;
top: 8px; left: 50%; transform: translateX(-50%);
```

Screen inside:
```css
background: var(--bg-elevated);
border-radius: 12px;
padding: 24px 12px 12px;
```

Spinner:
```css
width: 20px; height: 20px;
border: 2px solid var(--border);
border-top-color: var(--text-primary);
border-radius: 50%;
animation: spin 0.8s linear infinite;
```

---

## Comparison Table

```css
/* Container */
background: var(--bg-subtle);
border: 1px solid var(--border);
border-radius: var(--radius-lg);
overflow: hidden;

/* Header row */
background: var(--bg-elevated);
border-bottom: 1px solid var(--border);
font-family: var(--font-mono);
font-size: 11px;
text-transform: uppercase;
letter-spacing: 0.5px;
color: var(--text-tertiary);

/* vigil column header */
color: var(--text-primary);

/* Data rows */
grid-template-columns: 1fr repeat(3, 100px);
padding: 12px 20px;
font-size: 13px;

/* vigil "Built-in" cell */
color: #10b981;
```

---

## Animations

```css
/* Spinner */
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Eye blink + iris + pupil — see Logo section above */
/* Duration: 4s, ease-in-out, infinite */
/* Double blinks at ~18.5s and ~36.5s within each cycle */
```

---

## Footer

```css
/* Logo */
font-family: "Syne", var(--font-sans);
font-size: 15px;
font-weight: 700;
color: var(--text-tertiary);
letter-spacing: -0.3px;

/* Links */
font-size: 13px;
color: var(--text-tertiary);
transition: color 0.15s;

/* Separator dot · */
color: var(--text-tertiary);

/* Credit link (Instrument Serif italic) */
font-family: "Instrument Serif", Georgia, "Times New Roman", serif;
font-size: 18px;
font-style: italic;
color: var(--text-secondary);
```

---

## Responsive Breakpoints

| Breakpoint | Changes |
|---|---|
| `≤ 768px` | Patterns grid collapses to single column |
| `≤ 640px` | Features grid collapses to single column; comparison table shrinks column widths to 70px; nav hides text links (keeps GitHub button) |
| `≤ 600px` | State visualization stacks vertically |
| `≤ 640px` (page) | Section padding `56px 20px`; hero padding `64px 20px 56px`; nav padding `12px 16px` |

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
}
```

---

## Quick-start Checklist for a New Project

1. **Load fonts** — Inter, JetBrains Mono, Syne, Instrument Serif from Google Fonts
2. **Set CSS variables** — copy the `:root` block above
3. **Apply global reset** — margin/padding/box-sizing + font-smoothing
4. **Add ruler overlay** — `position: fixed`, four dashed lines + top/bottom, `pointer-events: none`
5. **Sticky nav** — `rgba(10,10,10,0.8)` + `backdrop-filter: blur(12px)` + border-bottom
6. **Use `#111` cards** with `1px solid #1e1e1e` borders and `12px` radius
7. **All interactive transitions** at `0.15s` for text/border color, `0.2s` for background
8. **Section structure** — mono uppercase eyebrow → tight heading (`-0.8px` tracking) → muted description → content
9. **Code highlighting** — Shiki `one-dark-pro`, `font-size: 13px`, `line-height: 1.7`
10. **No accent color** — the palette is intentionally monochrome; `#10b981` used only for a single "success" indicator
