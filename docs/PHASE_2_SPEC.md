# Phase 2 — Pupil Platform Extension

## Status

Draft / not started

---

## Objective

Expand Pupil from a self-contained desktop app into a platform others can build on and integrate
with. The two anchors are: surface Pupil in the OS (so study happens where you already are), and
open Pupil as a destination (so any AI tool can feed cards into it).

---

## Feature Areas

### 1. OS Bar Integration

Make Pupil ambient — accessible from the system tray / menu bar without opening the main window.

- **Menu bar / system tray icon** — persistent icon showing today's due count as a badge
- **Quick study popover** — click the icon to open a compact study session (5–10 cards) inline,
  no full window required
- **Due count notification** — optional desktop notification at a configurable daily time
  ("You have 24 cards due")
- **Global keyboard shortcut** — system-wide hotkey to open the quick study popover
- **Streak nudge** — gentle OS notification if you haven't studied today and a streak is at risk
- **Do Not Disturb awareness** — respect macOS Focus / DND; no notifications during focus modes

> Technical note: Tauri v2 supports tray icons and system notifications natively. The popover is a
> separate Tauri window or the tray plugin's native popover surface. Requires careful window
> lifecycle management — the main window and the tray popover share the same Rust backend.

---

### 2. MCP Server — Card Creation for External AI Tools

Expose Pupil as an MCP (Model Context Protocol) server so any compliant AI tool (Claude desktop,
Cursor, custom agents, etc.) can create, query, and manage cards programmatically.

- **Local MCP server** — Pupil runs a local MCP server (likely stdio transport for desktop, HTTP
  for future cloud)
- **`create_cards` tool** — accept a list of `{front, back, space_id}` objects; apply the same
  approval flow as the in-app AI generation (approve / discard / edit per card before commit)
- **`list_spaces` tool** — return the user's spaces so calling tools can resolve space names to IDs
- **`get_due_count` tool** — let agents check how many cards are due (useful for scheduling)
- **`create_space` tool** — optionally create a new space from a tool call
- **Approval gate** — all MCP-originated cards land in a review queue in the UI; nothing auto-
  commits without user sign-off (parity with in-app AI generation)
- **Auth / trust** — local-only by default; no external network exposure without explicit user opt-in
- **Claude desktop config example** — ship a one-click config snippet for Claude's
  `claude_desktop_config.json` so users can register Pupil as an MCP server in two steps

> Technical note: MCP is JSON-RPC over stdio (or HTTP+SSE). The Rust side spawns or listens as an
> MCP server; the React UI subscribes to a pending-cards queue via Tauri events. This is substantial
> work — needs its own planning chunk. Key unknowns: MCP spec stability, Tauri window ↔ background
> process communication, and how to handle approval UX when the main window is closed.

---

## Open Questions

- Should the menu bar popover be a mini study session (sequential cards) or a "what's due" summary
  with a "Start studying" CTA?
- MCP approval flow: should approvals be batched (review all at once) or one-at-a-time like the
  in-app AI generation flow?
- Do we want to support the MCP HTTP transport for potential future cloud/mobile pairing, or keep
  it stdio-only for Phase 2?
- Should MCP card creation bypass the AI approval flow if the caller explicitly flags cards as
  pre-approved (e.g., a trusted local script)?


TODO:
- Radix