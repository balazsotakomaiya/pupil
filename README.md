# 👁️ Pupil

Pupil is a local-first flashcard app for people who want the power of spaced repetition without the friction that usually comes with it.

Create focused spaces. Import your Anki decks. Generate new cards from a topic. Study with FSRS. Keep everything on your machine.

## Why Pupil

Most flashcard tools force a tradeoff.

- Anki is powerful, but rough.
- Lighter apps feel better, but their scheduling is weak.
- AI can generate content quickly, but it usually stops before the study loop begins.
- Too many modern study apps hide core features behind subscriptions and lock you into a paid product.

Pupil is built to close that gap: fast card creation, clean study flow, serious scheduling, and no account required. It is free and open source, so you are not boxed into the kind of recurring subscription model that tools like Quizlet push.

Pupil also intends to be more present in your day than tools like Anki usually are: subtle reminders, streaks that keep momentum up, and stats that help surface weak spots before they turn into blind spots.

## What It Does

- Organize your knowledge into named spaces.
- Create cards manually with a polished desktop-first editor.
- Import `.apkg` decks from Anki.
- Review AI-generated cards before saving them.
- Study per-space or across your full library.
- Schedule reviews with FSRS.
- Store your data locally in SQLite.

## Product Direction

Pupil is designed around a simple idea: studying should feel sharp, calm, and immediate.

- Local-first by default
- Fast enough to go from idea to deck in under a minute
- Structured for daily use, not just card authoring
- Opinionated UI instead of plugin-era complexity
- Open to future assistant workflows, including a possible MCP-style bridge so tools like Claude or ChatGPT could send cards directly into Pupil

## Built With

- React
- Vite
- Tauri v2
- SQLite
- `ts-fsrs`
- Bun

## Running It

```bash
bun install
```

Desktop app:

```bash
bun run --cwd apps/app dev
```

Marketing site:

```bash
bun run --cwd apps/site dev
```

Full workspace:

```bash
bun dev
```

## Docs

- Phase 1 spec: [docs/PHASE_1_SPEC.md](/Users/balazs/Projects/pupil/docs/PHASE_1_SPEC.md)
- Phase 2 spec: [docs/PHASE_2_SPEC.md](/Users/balazs/Projects/pupil/docs/PHASE_2_SPEC.md)
- App design notes: [apps/app/DESIGN.md](/Users/balazs/Projects/pupil/apps/app/DESIGN.md)
- Site design notes: [apps/site/DESIGN.md](/Users/balazs/Projects/pupil/apps/site/DESIGN.md)
