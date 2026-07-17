# Pupil Desktop App — Design Language

This guide describes the product’s visual intent and interaction patterns. It is not a CSS specification: implementation values, tokens, and animation details live in source files so they have one source of truth.

## Source of truth

Use these files when implementing or inspecting visual details:

- [Design tokens](./src/styles/tokens.css) for themes, color roles, spacing, radii, and font stacks.
- [Global foundations](./src/styles/reset.css), [shared UI](./src/styles/shared.css), and [animations](./src/styles/animations.css) for application-wide behavior.
- [Titlebar styles](./src/components/app-shell/AppTitlebar.module.css), [ruler overlay](./src/components/dashboard/RulersOverlay.module.css), and [eye logo](./src/components/dashboard/EyeLogo.tsx) for the core shell identity.
- The collocated module next to a component for its component-specific layout and state styles.

When a visual value changes, update its source file. Update this document only when the underlying design intent or reusable pattern changes.

---

## Where This Comes From

The desktop app inherits the visual identity of the Vigil site: a restrained palette, utilitarian typography, fine borders, and the ruler motif. The desktop adaptation carries a few distinctive choices:

- A Tauri-draggable titlebar with inline navigation replaces a site-style navbar.
- The app has no conventional footer; screens end with breathing room.
- Full-width dotted rulers separate major content regions.
- The study action is the dashboard’s visual focal point.
- The display serif has no current role in the desktop app.

These are defaults, not constraints. New screens can introduce a different navigation pattern or hierarchy when it better serves the task.

---

## Fonts and Typography

Inter is the primary reading and interface face. JetBrains Mono signals data: labels, timestamps, counts, source metadata, and other machine-like information. Syne is reserved for the Pupil wordmark.

The typography should feel compact, calm, and legible:

- Large headings use tighter tracking and establish a clear focal point.
- Section labels and compact metadata use spaced, uppercase mono text.
- Prose and control labels remain easy to scan at desktop density.
- Values should read as measurements, while nearby descriptions provide context.

Refer to the design tokens and the relevant component module for the current type scale.

---

## Themes and Color

Dark is the default appearance. A white mode is available from Settings → Appearance for a brighter study surface. Both modes share semantic roles for page, surface, elevated surface, border, ruler, primary text, secondary text, and subdued text.

The overall palette remains deliberately monochrome. Green is reserved for positive learning signals such as progress, due-state confirmation, and streaks. Introduce other semantic colors only when a state cannot be communicated clearly through hierarchy, copy, or the existing semantic roles.

The animated eye logo and wordmark inherit their foreground color, so they retain contrast in both themes. Theme behavior and persistence are implemented in [theme.ts](./src/lib/theme.ts); visual values belong in [tokens.css](./src/styles/tokens.css).

---

## Spacing and Layout

Use the shared spacing scale rather than inventing one-off layout values. The interface favors generous page rhythm with compact controls and dense, readable data surfaces.

The standard content pattern is:

1. A full-width ruler divider.
2. A section with a concise heading and optional description.
3. Focused content, usually constrained to a readable width.
4. Another divider before the next major region.

This pattern is useful for dashboards, settings, and data-heavy pages. Focused study views, modals, and import flows may use a different rhythm when it improves concentration or task completion.

---

## Rulers

Dotted rulers are the app’s visual signature. The dashboard overlay frames the window, while the shared divider separates major sections. They are structural punctuation rather than mandatory decoration: use them to clarify a hierarchy, and omit them when they would distract from a focused task.

The implementation is split between [RulersOverlay](./src/components/dashboard/RulersOverlay.tsx), its module, and the shared divider style.

---

## Titlebar

The titlebar is the desktop navigation shell. It contains the Pupil mark, navigation, contextual status, and primary shell actions. The titlebar itself remains draggable; every interactive control must opt out of the drag region.

Keep navigation flat and quickly scannable. The active tab should be identifiable without overwhelming the content beneath it. For screens with more depth, secondary navigation or a screen-specific titlebar is acceptable.

---

## Logo — Animated Eye

The eye is a small, expressive part of the product identity. It blinks periodically and the pupil drifts subtly, without competing with active work. It is always rendered with the current foreground color; do not hard-code a theme-specific logo color.

The SVG structure is in [EyeLogo.tsx](./src/components/dashboard/EyeLogo.tsx), and its motion is defined by [EyeLogo.module.css](./src/components/dashboard/EyeLogo.module.css) and the shared animation stylesheet.

---

## Controls and Cards

Use one high-emphasis action per screen whenever possible. Other actions should be quieter, typically as an outline or ghost control. A screen with many equally prominent buttons loses its hierarchy.

Cards are the workhorse surface for related information, actions, and data summaries. They should have a subtle boundary and a restrained hover response. Reuse the existing shared patterns or the closest domain component before creating a new card treatment.

Tables and activity lists should prioritize scanability: clear columns, subdued metadata, and one readable primary description. Keep visual density stable as information grows.

---

## Status, Motion, and Icons

Use status dots sparingly and reserve motion for useful feedback. The eye blink, positive-status pulse, and loading states should feel quiet rather than ornamental. New motion should follow the existing animation conventions in [animations.css](./src/styles/animations.css).

Icons are inline SVGs that inherit the surrounding color. Prefer the existing hand-authored icons when a suitable one exists; introduce a new icon with the same simple stroke-led visual language.

---

## Responsive Behavior

Pupil is a desktop app, but windows can become narrow. Preserve hierarchy as space contracts: allow grids to stack, reduce decorative density, and keep primary actions reachable. The component module and shared responsive rules are authoritative for breakpoints and layout changes.

---

## Building a New Screen

1. Start with an existing screen in the same product area and reuse its composition where appropriate.
2. Use the global tokens and shared layout primitives instead of recreating foundational styles.
3. Choose one clear primary action and make supporting actions quieter.
4. Use rulers and cards only when they clarify the content hierarchy.
5. Keep metadata compact and distinguish it from explanatory text.
6. Test both appearance modes and narrow window layouts.
7. Keep component-specific CSS in a collocated module.

The goal is a coherent product, not pixel-perfect compliance with a document. When a new pattern proves useful across screens, encode it in source first, then describe its purpose here.
