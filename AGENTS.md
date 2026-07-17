# Pupil — Agent Guide

This is the repo-level guide for AI agents working anywhere in `pupil`. It covers the monorepo shape, the main architectural boundaries, and the conventions that matter across the whole project. For deeper app-specific detail, read the nested guide in [`apps/app/AGENTS.md`](./apps/app/AGENTS.md) after this one.

## Workspace map

```text
.
├── apps/
│   ├── app/        Desktop product: Tauri + React + SQLite
│   └── site/       Marketing site: Vite + React
├── docs/           Release notes, specs, and design references
├── scripts/        Repo-level automation, including desktop release tooling
├── README.md       Product overview and developer entrypoint
└── BUILDING.md     Cross-platform build prerequisites
```

There is no meaningful shared package layer yet. Most implementation work happens inside `apps/app`.

## What each app does

### `apps/app`

Pupil’s shipped product. It is a local-first flashcard desktop app with:

- React + TypeScript in `apps/app/src`
- Tauri v2 + Rust in `apps/app/src-tauri/src`
- SQLite as the source of truth for persisted app data
- Tauri Stronghold for encrypted AI API-key storage
- FSRS scheduling computed in the frontend and persisted by the backend

Use this app when the task touches studying, cards, imports, AI generation, dashboard/tray behavior, settings, or release flows.

### `apps/site`

The marketing site. It is much simpler: a Vite/React static site with no Tauri backend and no local database. Use it only for landing-page, manifesto, or marketing-content tasks.

## Architecture at a glance

### Desktop app data flow

1. React route/page code calls frontend library helpers in `apps/app/src/lib`.
2. Those helpers either:
   - call Tauri commands through `invokeCommand()` in desktop mode, or
   - fall back to local web storage in browser-only mode.
3. Rust command handlers in `apps/app/src-tauri/src/commands.rs` validate inputs, open a SQLite connection, and delegate to feature modules.
4. Feature modules such as `cards.rs`, `spaces.rs`, `analytics.rs`, `imports.rs`, `settings.rs`, and `ai.rs` own the actual SQL and storage behavior.

Keep command handlers thin. Keep SQL close to the feature it serves.

### Frontend structure

- `src/routes/`: route shell and route-level hooks
- `src/routes/pages/`: screen entrypoints that compose queries and page-specific mutations
- `src/components/`: reusable UI, usually grouped by screen/domain
- `src/lib/`: data access, query helpers, derived state, runtime detection, and browser fallbacks

If something is long-lived shell behavior rather than presentational UI, prefer a route-scoped hook near `src/routes/` over stuffing more logic into `root-shell.tsx`.

### Backend structure

- `lib.rs`: crate root and Tauri bootstrap
- `app.rs`: app paths, database bootstrap, migrations, menu, logging
- `commands.rs`: Tauri IPC surface
- `normalize.rs`: backend-side validation and normalization
- `types.rs`: shared DTOs and normalized payload shapes
- feature modules: `cards.rs`, `spaces.rs`, `analytics.rs`, `imports.rs`, `settings.rs`, `ai/`, `tray.rs`

## High-value invariants

- SQLite is the canonical persisted state for the desktop app.
- AI secrets do not belong in SQLite. They live in Stronghold only.
- FSRS scheduling stays in TypeScript. Rust persists validated results; it should not recalculate schedules.
- Migrations are append-only and wired through the typed `MIGRATIONS` registry in `apps/app/src-tauri/src/migrations.rs`. Each action is explicit SQL or deterministic Rust, declares backup eligibility, and runs transactionally without network or UI dependencies.
- Query invalidation matters. If a mutation changes cards, spaces, dashboard stats, or study settings, update the matching React Query invalidation path.
- Tray/dashboard/study counts should share queue rules conceptually. If one count changes, check the others.
- **CSS is fully modular in `apps/app`.** All component styles live in collocated `*.module.css` files. Do not create a new global stylesheet or add component-specific rules to `src/styles/shared.css`. See `apps/app/AGENTS.md` for the full CSS conventions.

## Testing and validation

Repo-level commands:

```bash
bun run lint
bun run typecheck
bun run test
bun run lint:rust
bun run format:check
```

Targeted commands:

```bash
bun run test:ts
bun run test:rust
bun run --cwd apps/app dev
bun run --cwd apps/site dev
```

Git hook workflow:

- `bun install` runs the repo `prepare` script, which installs Lefthook.
- The `pre-commit` hook runs `bun run lint`, `bun run lint:rust`, and `bun run format:check`.
- Do not rely on the hook to auto-fix files for you; make the tree pass locally before committing.

Test placement conventions:

- Frontend tests live in dedicated `*.test.ts` files, usually next to the library module they cover.
- Rust tests live in dedicated files under `apps/app/src-tauri/src/tests/`.
- Do not embed new tests inside production modules unless there is a strong reason.

Test quality rules:

- Assert observable contracts, not internal implementation. Prefer behavior the user/application will notice (counts, persisted rows, returned fields, error kinds) over row indexes, SQL column order, or private helper shapes.
- One test, one behavior. Do not chain unrelated operations (create + update + suspend + delete + cleanup) inside a single `#[test]`; if the flow itself is the contract, name the test for the flow. Split otherwise.
- The test name must cover everything the test asserts. If you tack on an unrelated `trim_trailing_zeroes` check, or a whitespace-parsing check, into a prompts test, split or rename.
- Keep tests isolated and deterministic. Use the shared `tests/support.rs` seed helpers (`open_test_connection`, `seed_space`, `seed_card`, `seed_review_log`, `TEST_NOW`) instead of inlining raw SQL. Avoid `util::now_ms()` for assertions that bucket by day — use `TEST_NOW` so the suite is not midnight-boundary flaky.
- Assert grouping/dated series with predicates ("the bucket for today has N, all earlier buckets are 0"), not positional slices like `array[5..]`. Array layout is not the public contract.
- Clean up any files you create during a test (`fs::remove_file` for temp CSVs, etc.).
- To expose internals to tests, prefer the established `#[cfg(test)] pub(crate) use …` re-export pattern in the module root; widen `pub(super)` to `pub(crate)` rather than `pub` or `pub(super)` plus non-test re-export. Never widen beyond `pub(crate)`.
- New Rust tests must compile and pass under `bun run test:rust` alongside the staged `tests/mod.rs` entry that declares their module — stage the module file and the `mod …;` line together.

## Release and build docs

- Desktop release flow: [`docs/RELEASING.md`](./docs/RELEASING.md)
- Cross-platform build prerequisites: [`BUILDING.md`](./BUILDING.md)
- Product/project overview: [`README.md`](./README.md)

## How to choose where to change code

- UI copy, composition, and interactions: `apps/app/src/components` or `apps/app/src/routes/pages`
- Query behavior and desktop/web data access: `apps/app/src/lib`
- New desktop capabilities or persistence changes: `apps/app/src-tauri/src`
- Marketing-site content or layout: `apps/site/src`
- Release automation: `.github/workflows/` and `scripts/desktop-release.mjs`

## Nested guidance

Before making non-trivial changes inside `apps/app`, also read:

- [`apps/app/AGENTS.md`](./apps/app/AGENTS.md)
- [`apps/app/DESIGN.md`](./apps/app/DESIGN.md) for visual-language work

For the site’s visual language, use:

- [`apps/site/DESIGN.md`](./apps/site/DESIGN.md)
