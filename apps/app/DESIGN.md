# App — Design Language

A reference for the desktop app's visual identity and UX patterns. The app runs inside a Tauri window and is designed as a focused, information-dense productivity tool — not a marketing site. Every decision here favors clarity, speed, and keyboard-friendliness over visual flair.

---

## Fonts

Loaded via Google Fonts (see `index.html`):

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

| Role | Family | Weight | Notes |
|---|---|---|---|
| Body / UI | Inter | 400, 500, 600, 700 | Fallback: `-apple-system, BlinkMacSystemFont, sans-serif` |
| Code / mono / labels | JetBrains Mono | 400, 500 | Fallback: `"SF Mono", "Fira Code", monospace` |

CSS variables:

```css
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: "JetBrains Mono", "SF Mono", "Fira Code", monospace;
```

Syne and Instrument Serif are site-only. Never use them in the app.

---

## Color Palette

All dark theme. No light mode.

```css
/* Backgrounds — three depth levels */
--bg:          #0a0a0a;  /* window background — near black */
--bg-subtle:   #111111;  /* panels, cards */
--bg-elevated: #171717;  /* nested cards, active rows, inputs-on-panel */

/* Borders */
--border:       #222222;  /* default */
--border-hover: #333333;  /* hover / focus */

/* Text */
--text-primary:   #e8e8e8;  /* content, active labels */
--text-secondary: #777777;  /* supporting text, field labels */
--text-tertiary:  #444444;  /* placeholders, metadata, faded chrome */
```

No gradients. Ever. Depth comes from flat background stacking (`--bg` → `--bg-subtle` → `--bg-elevated`) and border contrast.

### Semantic / State Colors

| Use | Value |
|---|---|
| Error text | `rgba(248, 113, 113, 0.9)` |
| Error banner background | `rgba(248, 113, 113, 0.06)` |
| Error banner border | `rgba(248, 113, 113, 0.25)` |
| Success indicator | `#10b981` — use only for explicit success state |

---

## Spacing & Layout

```css
--radius:    6px;   /* panels, cards */
--radius-sm: 4px;   /* inputs, buttons, small elements */
```

### Window Layout

The app has no OS-level title bar chrome of its own — Tauri handles that. The root layout is:

```
┌─────────────────────────────────────────────┐
│  [window chrome — Tauri / OS]               │
├─────────────────────────────────────────────┤
│                                             │
│   .app-shell   (max-width: 1120px, auto   │
│                 horizontal margins,         │
│                 padding: 48px 40px 64px)    │
│                                             │
└─────────────────────────────────────────────┘
```

Future layout may introduce a sidebar. When it does, use a fixed-width left rail (200–240px) and a flex-grow main area — never shrink content to fit chrome.

### Content Width Tokens

| Context | Value |
|---|---|
| App shell max-width | `1120px` |
| Section vertical padding | `40px 0` |
| Ruler visual range | `1120px` |
| Panel gap | `20px` |
| Card padding | `24px` |
| Compact row padding | `12px 16px` |

### Spacing Scale

Prefer multiples of 4px. Common values in use:

`4` `8` `12` `16` `20` `24` `32` `40` `48` `64`

---

## Typography Scale

App typography is tighter than the site. Everything serves scanability at desktop viewing distance.

### Page / Section Title
```css
font-size: clamp(28px, 3vw, 38px);
font-weight: 600;
letter-spacing: -0.8px;
line-height: 1.15;
```

### Panel Title
```css
font-size: clamp(18px, 2vw, 24px);
font-weight: 600;
letter-spacing: -0.5px;
```

### Eyebrow / Section Label
```css
font-family: var(--font-mono);
font-size: 11px;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 1.4px;
color: var(--text-tertiary);
```

### Body / Description
```css
font-size: 15px;
line-height: 1.6;
color: var(--text-secondary);
```

### Small / Dense UI Text
```css
font-size: 13px;
line-height: 1.5;
color: var(--text-secondary);
```

### Metadata / Tertiary
```css
font-size: 12px;
color: var(--text-tertiary);
```

### Monospace / Path / Code
```css
font-family: var(--font-mono);
font-size: 13px;
background: var(--bg-subtle);
padding: 2px 6px;
border-radius: 4px;
border: 1px solid var(--border);
color: var(--text-secondary);
```

---

## Panels & Cards

Panels are the primary content containers. Flat `--bg-subtle` background. No gradients, no glow, no shadows.

```css
.panel {
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius);   /* 6px */
  padding: 16px;
  transition: border-color 0.15s;
}
```

Panel heading — a small functional label that sits above the content with a bottom border:

```css
.panel-heading {
  border-bottom: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  padding-bottom: 10px;
}
```

No marketing titles. No `clamp(28px, 4vw, 38px)`. The heading names the thing, nothing more.

Cards within a panel (metric cards, step list items) use `--bg-elevated`:

```css
.card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);   /* 4px */
  padding: 8px 10px;
}
```

---

## Metric Cards

Small stat tiles used in dashboards and space detail views. Three per row by default.

```css
.metric-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* value */
font-size: 20px;
font-weight: 600;
color: var(--text-primary);

/* label */
font-size: 11px;
font-family: var(--font-mono);
text-transform: uppercase;
letter-spacing: 0.8px;
color: var(--text-tertiary);
```

---

## Buttons

Buttons communicate action weight through background density. Keep the hierarchy shallow — at most three visual levels in a single context.

```css
/* Base */
.button {
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  padding: 8px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  white-space: nowrap;
}

/* Primary — highest weight action per panel */
.button-primary {
  background: rgba(255,255,255,0.08);
  border-color: var(--border-hover);
  color: var(--text-primary);
}
.button-primary:hover {
  background: rgba(255,255,255,0.12);
}

/* Secondary — supporting action */
.button-secondary {
  background: transparent;
  color: var(--text-secondary);
}
.button-secondary:hover {
  background: rgba(255,255,255,0.04);
  color: var(--text-primary);
  border-color: var(--border-hover);
}

/* Danger — destructive action; always paired with confirmation */
.button-danger {
  background: transparent;
  border-color: rgba(248,113,113,0.2);
  color: rgba(248,113,113,0.8);
}
.button-danger:hover {
  background: rgba(248,113,113,0.06);
  border-color: rgba(248,113,113,0.4);
  color: rgba(248,113,113,1);
}

/* Disabled */
.button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

### Button Placement Rules

- **One primary action per panel.** Use secondary for everything else.
- Group related actions in `.action-row` with `gap: 8px`.
- Dangerous actions live at the end of an action row or in a dedicated "danger zone" section.
- Never use icon-only buttons without a visible tooltip.

---

## Form Elements

```css
/* Field wrapper */
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Label */
.field-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: 0.1px;
}

/* Hint */
.field-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.5;
}

/* Input */
.input {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 9px 12px;
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--text-primary);
  transition: border-color 0.15s, background 0.15s;
  outline: none;
}
.input::placeholder { color: var(--text-tertiary); }
.input:hover  { border-color: var(--border-hover); }
.input:focus  {
  border-color: var(--border-hover);
  background: var(--bg-subtle);
}
```

### Inline Forms

Forms that live inside a panel (e.g., "Create space") use `.inline-form` with a compact layout:
- Stack fields vertically with `gap: 16px`
- Action row sits below the last field with `margin-top: 4px`
- No form title needed if the panel title already names the action

---

## Status Indicators

### Pills / Badges

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  background: var(--bg-elevated);
  white-space: nowrap;
}
```

Use badges for: current mode (local / web), counts, version numbers, short status values. Not for actions.

### Status Banners

Full-width alert strips that appear above the main content area when something needs attention. They should be dismissible once acknowledged.

```css
.status-banner {
  background: rgba(248, 113, 113, 0.05);
  border: 1px solid rgba(248, 113, 113, 0.15);
  border-radius: var(--radius);
  padding: 12px 16px;
  font-size: 13px;
  color: rgba(248, 113, 113, 0.9);
  line-height: 1.5;
}
```

---

## Lists & Tables

### Stat / Definition List

Key-value pairs in a panel. Zebra striping via alternating transparent backgrounds.

```css
.stat-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.stat-list dt { font-size: 12px; color: var(--text-tertiary); }
.stat-list dd { font-size: 13px; color: var(--text-primary); font-weight: 500; }
```

### Step List

Ordered list with subtle row backgrounds for instructional or "readiness" content:

```css
.step-list li {
  padding: 8px 12px;
  background: rgba(255,255,255,0.02);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}
```

---

## Empty States

Shown when a list or panel has no data. Always give the user a next action.

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 24px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 13px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-lg);
}
```

Rule: never show just a message — pair it with a button or instructions pointing to where the action lives.

---

## Structural Rulers

Thin dashed vertical lines that visually align the content column. They are decorative only — `pointer-events: none`, `position: fixed`, `z-index: 50`.

```css
--ruler: #2a2a2a;

/* Vertical dashed line */
background-image: repeating-linear-gradient(
  to bottom,
  var(--ruler) 0px, var(--ruler) 1px,
  transparent 1px, transparent 5px
);

/* Horizontal dashed divider */
background-image: repeating-linear-gradient(
  to right,
  var(--ruler) 0px, var(--ruler) 1px,
  transparent 1px, transparent 5px
);
```

Ruler positions mirror the content column edges (`left/right: max(40px, calc((100vw - 1120px) / 2))`), plus outer-edge sentinels at `left: 0` and `right: 0`.

`.ruler-divider` — a full-width dashed horizontal line used between major sections.

---

## Motion & Transitions

Keep motion subtle and fast. The app should feel snappy, not animated.

| Property | Duration | Easing |
|---|---|---|
| Color, border-color, text color | `0.15s` | `ease` |
| Background | `0.15s` | `ease` |
| Panel border on hover | `0.15s` | `ease` |
| Spinner rotation | `0.8s` | `linear` |

Never animate layout (width, height, position) unless implementing a deliberate panel collapse. Prefer opacity + transform for show/hide transitions if added in future.

---

## Keyboard & Focus

All interactive elements must be keyboard-reachable and visibly focused. Do not suppress the default focus ring — style it instead:

```css
:focus-visible {
  outline: 2px solid var(--border-hover);
  outline-offset: 2px;
}
```

Tab order should follow visual reading order (left-to-right, top-to-bottom). Modals and overlays (when added) must trap focus.

---

## Information Density

This is a productivity app — users spend time here. Prefer **medium density**: enough breathing room to be readable at a glance, tight enough that important information is never off-screen.

| Tier | Example | Padding |
|---|---|---|
| Dense (lists, rows) | Stat rows, step list items | `8–12px` vertical |
| Default (cards, panels) | Metric card, space card | `16–24px` |
| Spacious (hero, section intro) | Page title area | `40–64px` |

Avoid large empty sections. If a panel is mostly whitespace, it's probably two things that should be merged.

---

## Responsive Behavior

The app is desktop-first and runs in a resizable Tauri window. Minimum useful window width: ~600px.

| Breakpoint | Change |
|---|---|
| `≤ 980px` | Panel grid collapses to single column |
| `≤ 720px` | Full-width layout, padding → `20px`, metric grid single column |

No mobile-specific views are planned. The app does not need to work on phone screens.

---

## Borders

All borders are `1px solid`:

| State | Color |
|---|---|
| Default | `var(--border)` = `#1e1e1e` |
| Hover / focus | `var(--border-hover)` = `#333` |
| Error state | `rgba(248, 113, 113, 0.3)` |
| Active / selected | `var(--text-tertiary)` = `#555` |

---

## Border Radii

| Context | Value |
|---|---|
| Input, small button, inline tag | `var(--radius)` = `8px` |
| Panel, large card | `var(--radius-lg)` = `12px` |
| Badge / pill | `999px` |
| Very small element (copy button) | `6px` |
| Spinner | `50%` |

---

## Global Resets

```css
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  line-height: 1.5;
  background: var(--bg);
  color: var(--text-primary);
  font-family: var(--font-sans);
}
```

---

## Quick-Start Checklist for New UI

1. **CSS variables** — copy the `:root` block; never hard-code colors
2. **Fonts** — Inter + JetBrains Mono only (no Syne, no serif)
3. **Dark base** — everything starts at `--bg` (#0a0a0a); surfaces stack up through `--bg-subtle` → `--bg-elevated`
4. **Panels** — wrap logical groups in `.panel`; use gradient-border treatment for depth
5. **One primary button per panel** — secondary for everything else, danger at the bottom
6. **Eyebrow labels** — mono, uppercase, `letter-spacing: 1.4px`, tertiary color before every section
7. **Transitions** — `0.15s ease` for all color/border changes; nothing else animates
8. **Focus rings** — always visible; use `outline: 2px solid var(--border-hover)`
9. **Empty states** — always include a next-action, never just a message
10. **No accent color by default** — palette is monochrome; introduce `#10b981` only for explicit success states
