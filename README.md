# Pupil

Pupil is a local-first flashcard app for people who want the power of spaced repetition without the friction that usually comes with it.

Create focused study spaces. Import Anki decks. Generate cards from any topic with AI. Study with FSRS. Everything stays on your machine.

## Why Pupil

Most flashcard tools force a tradeoff.

- Anki is powerful but rough around the edges.
- Lighter apps feel better but their scheduling is weak.
- AI can generate content fast but usually drops off before the study loop begins.
- Modern study tools hide the good stuff behind subscriptions and lock you in.

Pupil is built to close that gap: fast card creation, a clean study flow, serious scheduling, and no account required. It is free and open source.

It is also designed to be more present in your day than Anki typically is — subtle reminders, streaks that keep momentum going, and stats that surface weak spots before they become blind spots.

## What it does

- Organize knowledge into named spaces
- Create cards manually with a desktop-first editor
- Import `.apkg` decks from Anki
- Generate cards from a topic using any OpenAI-compatible or Anthropic model
- Review AI-generated cards before they land in your library
- Study per-space or across your full collection
- Schedule reviews with FSRS
- Export review history as CSV
- Store everything locally in SQLite — no account, no sync

## Built with

- **Tauri v2** — native desktop shell
- **React + Vite** — frontend
- **Rust** — backend, database access, AI integration
- **SQLite** (bundled via `rusqlite`) — local data store
- **Tauri Stronghold** — encrypted storage for the AI API key
- **ts-fsrs** — spaced repetition scheduling (runs in the frontend)
- **Bun** — package manager and workspace runner

## Running it

Install dependencies:

```bash
bun install
```

Start the desktop app:

```bash
bun run --cwd apps/app dev
```

Start the marketing site:

```bash
bun run --cwd apps/site dev
```

Start everything at once:

```bash
bun dev
```

The first Rust build takes a few minutes. Subsequent dev starts are incremental.

## Project layout

```
apps/
  app/      Desktop app (Tauri + React)
  site/     Marketing site
packages/   Shared packages
docs/       Specs and design notes
```

Key docs:

- [Phase 1 spec](docs/PHASE_1_SPEC.md)
- [Phase 2 spec](docs/PHASE_2_SPEC.md)
- [App design notes](apps/app/DESIGN.md)
- [Agent/contributor guide](apps/app/AGENTS.md)

## Product direction

Pupil is designed around one idea: studying should feel sharp, calm, and immediate.

- Local-first by default
- Fast enough to go from idea to deck in under a minute
- Structured for daily use, not just card authoring
- Opinionated UI rather than plugin-era complexity
- Open to future assistant workflows — including a possible MCP bridge so tools like Claude or ChatGPT could push cards directly into Pupil
