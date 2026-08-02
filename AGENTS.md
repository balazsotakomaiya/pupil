# Pupil — Agent Guide

This is the repo-level guide for AI agents working anywhere in `pupil`. It covers the monorepo shape, the main architectural boundaries, and the conventions that matter across the whole project. For deeper app-specific detail, read the nested guide in [`apps/app/AGENTS.md`](./apps/app/AGENTS.md) after this one.

## Workspace map

```text
.
├── apps/
│   ├── app/        Desktop product: Tauri + React + SQLite
│   └── site/       Marketing site: Vite + React
├── packages/
│   └── core/       @pupil/core: platform-agnostic domain layer
├── docs/           Release notes, specs, and design references
├── scripts/        Repo-level automation, including desktop release tooling
├── README.md       Product overview and developer entrypoint
└── BUILDING.md     Cross-platform build prerequisites
```

Most implementation work still happens inside `apps/app`. Logic that must behave identically on every surface belongs in `packages/core` instead.

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

### `packages/core`

`@pupil/core` — the domain layer shared by every current and future surface: domain types, FSRS scheduling, study-queue rules, shared validation, day/streak helpers, and the `PupilStorage` interface.

It is deliberately platform-free. `packages/core/tsconfig.json` sets `"lib": ["ES2022"]` and `"types": []`, so touching `window`, `localStorage`, or any Node/DOM global fails `typecheck`. Do not add React, Tauri, network, or storage dependencies here.

Consume it through the package root (`import { … } from "@pupil/core"`). Deep imports into `packages/core/src` are not part of the contract. See [`packages/core/README.md`](./packages/core/README.md).

## Architecture at a glance

### Desktop app data flow

1. React route/page code calls `getStorage()` from `apps/app/src/lib/storage` and invokes a method on the returned `PupilStorage`.
2. `apps/app/src/lib/storage/index.ts` resolves which implementation is active — `createTauriStorage()` in the desktop shell, `createWebStorage()` in a plain browser. This is the only runtime check for where data lives.
3. `storage/tauri.ts` calls Tauri commands; Rust handlers in `apps/app/src-tauri/src/commands.rs` validate inputs, open a SQLite connection, and delegate to feature modules.
4. Feature modules such as `cards.rs`, `spaces.rs`, `analytics.rs`, `imports.rs`, `settings.rs`, and `ai/` own the actual SQL and storage behavior.

Keep command handlers thin. Keep SQL close to the feature it serves.

Domain rules used along that path — scheduling, queue construction, validation, day/streak math — come from `@pupil/core` rather than being written inline, so every surface computes them the same way.

**Do not add an `isTauriRuntime()` branch to a data-access path.** That check belongs in `storage/index.ts` alone; anywhere else it re-splits the seam. Adding a persistence operation means adding it to the `PupilStorage` interface in `packages/core` and implementing it in *both* `storage/tauri.ts` and `storage/web.ts` — the compiler enforces that. Platform capabilities that are not persistence (tray, notifications, bootstrap info, file export) legitimately stay outside the interface.

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
- FSRS scheduling stays in TypeScript, in `@pupil/core`. Rust persists validated results; it should not recalculate schedules.
- Cross-surface logic belongs in `packages/core`, not `apps/app/src/lib`. If a rule would have to be repeated for a browser, mobile, or sync backend to behave correctly, it is core logic. `apps/app/src/lib` keeps only platform wiring: Tauri IPC, web-storage fallbacks, and app-specific view-model shaping.
- All persistence goes through `PupilStorage`. Call sites use `getStorage()`; they never import a backend directly and never branch on the runtime.
- `packages/core` must stay platform-free. No `window`, DOM, React, Tauri, or network access — its `typecheck` is configured to fail if that slips in.
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
- Domain-logic tests belong with the module they cover in `packages/core/src`, and run via `bun run test:ts` alongside the app suite.
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
- Scheduling, queue rules, domain types, shared validation: `packages/core/src`
- New desktop capabilities or persistence changes: `apps/app/src-tauri/src`
- Marketing-site content or layout: `apps/site/src`
- Release automation: `.github/workflows/` and `scripts/desktop-release.mjs`

## Nested guidance

Before making non-trivial changes inside `apps/app`, also read:

- [`apps/app/AGENTS.md`](./apps/app/AGENTS.md)
- [`apps/app/DESIGN.md`](./apps/app/DESIGN.md) for visual-language work

For the site’s visual language, use:

- [`apps/site/DESIGN.md`](./apps/site/DESIGN.md)
