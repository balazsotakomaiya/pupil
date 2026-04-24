# Pupil App — Agent Guide

This document is for AI agents (and developers acting like them) working inside `apps/app`. It describes the architecture, the key files, how things connect, and the conventions to follow when adding or changing something.

---

## What this app is

A local-first spaced-repetition desktop app. The user creates "spaces" (topic buckets), adds flashcards manually or via AI generation, imports Anki decks, and studies using FSRS scheduling. Everything lives in a single SQLite file on the user's machine — no cloud, no account.

---

## Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v2 (Rust) |
| Frontend | React + Vite + TypeScript |
| Routing | TanStack Router (memory history) |
| Data fetching | TanStack Query |
| Styling | CSS Modules (scoped, collocated `*.module.css`) + global tokens/reset/shared |
| Package manager | Bun |
| Database | SQLite via `rusqlite` (bundled) |
| Secrets storage | Tauri Stronghold (`tauri-plugin-stronghold`) |
| FSRS scheduling | `ts-fsrs` — runs in the frontend, persisted by the backend |
| AI generation | OpenAI-compatible or Anthropic API (user-configured) |

---

## Directory layout

```
apps/app/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── routes/             # Router shell, route pages, and route-scoped hooks
│   ├── styles/             # Global design tokens, reset, shared utilities
│   ├── types/              # Ambient type declarations
│   └── lib/                # Frontend utilities, query helpers, and Tauri command wrappers
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Entry point — just calls lib::run()
│   │   ├── lib.rs          # Crate root and Tauri wiring
│   │   ├── app.rs          # App bootstrap, paths, connections, migrations, menu
│   │   ├── commands.rs     # Tauri command handlers
│   │   ├── ai.rs           # AI settings, Stronghold, prompt building, provider calls
│   │   ├── spaces.rs       # Space queries and mutations
│   │   ├── cards.rs        # Card queries, mutations, and review persistence
│   │   ├── analytics.rs    # Dashboard and per-space reporting queries
│   │   ├── imports.rs      # Anki import transaction logic
│   │   ├── normalize.rs    # Backend input normalization
│   │   ├── settings.rs     # Export/reset helpers and settings queries
│   │   ├── types.rs        # Shared DTOs and internal data shapes
│   │   ├── constants.rs    # Shared constants and migration registry
│   │   └── util.rs         # Small cross-cutting helpers
│   ├── migrations/         # SQL schema files (applied in order at startup)
│   ├── capabilities/       # Tauri capability definitions (IPC permissions)
│   └── tauri.conf.json     # App metadata, window config, plugin config
```

Archived HTML mockups live in `docs/design-references/`, not inside the app source tree.

---

## Frontend architecture

The frontend is organized in three main layers:

1. **Route shell and pages** — `src/routes/root-shell.tsx`, `src/routes/useRootShellDataSync.ts`, and `src/routes/pages/*`
2. **Feature UI** — `src/components/*`
3. **Data/runtime helpers** — `src/lib/*`

Route pages should compose queries, mutations, and navigation. Presentation stays in components. Long-lived shell side effects should usually live in a dedicated route hook rather than expanding `root-shell.tsx` directly.

TanStack Query is the default server-state layer. If a mutation changes cards, spaces, dashboard stats, or study settings, update the relevant invalidation helper in `src/lib/query.ts`.

---

## How the backend is organized

The Rust backend is split by responsibility:

1. **`lib.rs`** — crate root. Registers Tauri commands and starts the app.
2. **`app.rs`** — app bootstrap and infrastructure: menu, app-data paths, SQLite connections, migrations, backup creation.
3. **`commands.rs`** — the public Tauri IPC surface. These functions stay thin: open a connection, normalize input, call feature/storage code, map errors.
4. **`types.rs`** — shared structs for command inputs/outputs plus internal normalized shapes.
5. **`constants.rs`** — app-wide constants, Stronghold identifiers, AI defaults, migration registry.
6. **Feature/storage modules** — `spaces.rs`, `cards.rs`, `analytics.rs`, `imports.rs`, `settings.rs`, `ai.rs`.
7. **`normalize.rs`** — validation and coercion at the backend boundary.
8. **`util.rs`** — small shared helpers like timestamps, tag encoding, and storage error mapping.

The guiding rule is pragmatic separation: keep thin command handlers, keep SQL close to the feature it serves, and avoid layers that only forward calls.

---

## Adding a new Tauri command

1. Define the input struct (if needed) with `#[derive(Deserialize)]` and `#[serde(rename_all = "camelCase")]`.
2. Define the output struct with `#[derive(Serialize)]` and `#[serde(rename_all = "camelCase")]`.
3. Write the storage function (`fn do_thing_row(...)`) that does the SQL work.
4. Write the command function annotated with `#[tauri::command]`. It should: open a connection, normalize input, call the storage function, and return a structured `AppError` on failure.
5. Register the command in the `tauri::generate_handler![...]` list inside `run()`.
6. Add a corresponding TypeScript wrapper in `src/lib/` using `invokeCommand()` from `src/lib/ipc.ts`.

---

## Database conventions

- All IDs are `nanoid!(12)` — 12-character random strings.
- All timestamps are Unix milliseconds stored as `INTEGER`. Use `now_ms()` to get the current time.
- Tags are stored as a JSON array string in a nullable `TEXT` column. Use `encode_tags` / `decode_tags`.
- Schema changes go in a new file under `migrations/` named `NNNN_description.sql`. Add the new `Migration` entry to the `MIGRATIONS` slice in `src-tauri/src/constants.rs`.
- Migrations that contain `DROP TABLE`, `ALTER TABLE`, `DELETE FROM`, or `UPDATE` automatically trigger a pre-migration database backup.
- Foreign keys are enforced (`PRAGMA foreign_keys = ON`). On delete cascade is used for cards and review logs when their parent space is deleted.

---

## FSRS scheduling

Scheduling runs entirely in the TypeScript frontend using `ts-fsrs`. When the user submits a review, the frontend calculates the new card state and passes the full computed result to the `review_card` Tauri command. The backend validates and persists it — it does not recalculate anything.

FSRS state values: `0 = New`, `1 = Learning`, `2 = Review`, `3 = Relearning`.
Grades: `1 = Again`, `2 = Hard`, `3 = Good`, `4 = Easy`.

---

## Secrets and the Stronghold vault

The AI API key is stored in a Tauri Stronghold encrypted snapshot at `{appDataDir}/pupil.hold`. It is never written to SQLite. The encryption password is derived deterministically from the app data path and OS username using SHA-256, so the snapshot is machine-bound.

When adding new secrets, follow the same pattern: `open_stronghold` → get/create client → read or write via the store → call `stronghold.save()`.

---

## AI provider integration

The app speaks two wire formats:

- **OpenAI-compatible** — any base URL that does not contain `anthropic.com`. Posts to `{baseUrl}/chat/completions` with `Authorization: Bearer {key}`.
- **Anthropic** — detected when the base URL contains `anthropic.com`. Posts to `{baseUrl}/messages` with `x-api-key: {key}` and `anthropic-version: 2023-06-01`.

Card generation uses a fixed system prompt (`AI_SYSTEM_PROMPT`) and a per-request user prompt assembled by `build_generate_cards_prompt`. The model is expected to return a bare JSON array. `extract_json_array_candidate` strips markdown fences before parsing in case the model ignores the formatting instruction.

---

## Running the app in development

```bash
# From the repo root
bun install

# Start the Tauri dev window (hot-reloads the frontend, recompiles Rust on save)
bun run --cwd apps/app dev
```

The Rust backend compiles with `cargo` under the hood. First build takes a while. Subsequent rebuilds are incremental.

## Testing layout

- Frontend tests live in dedicated `*.test.ts` files, mainly under `src/lib/`.
- Rust tests live in dedicated files under `src-tauri/src/tests/`.
- Keep tests out of production modules unless there is a compelling reason they must be co-located.

## Git hooks

- Repo hooks are managed with Lefthook via the root `lefthook.yml`.
- `bun install` triggers the root `prepare` script, which installs the hooks.
- The repo `pre-commit` hook runs `bun run lint`, `bun run lint:rust`, and `bun run format:check`.
- Treat the hook as a guardrail, not as the primary way to discover issues. Run the same checks yourself before committing larger changes.

---

## CSS conventions

All component-specific styles use scoped CSS Modules — a collocated `ComponentName.module.css` file next to each component. **Do not add new styles to global CSS files.**

Global CSS lives in `src/styles/`:

| File | Purpose |
|---|---|
| `tokens.css` | Design tokens (colors, spacing, typography, etc.) |
| `reset.css` | Base reset — box-sizing, body, font inheritance |
| `utilities.css` | Single-purpose utility classes |
| `animations.css` | Named `@keyframes` used across multiple components |
| `shared.css` | Global classes shared by multiple features (`.page`, `.section`, `.dialog-*`, `.field-*`, `.more-menu-*`, etc.), scrollbars, responsive overrides |

Rules:
- **New component styles → collocated `.module.css` file.** Never add to `shared.css` unless the class is genuinely used in multiple unrelated components.
- **Class names in modules use camelCase** (`.cardState`, not `.card-state`). Access via `styles.cardState` in JSX.
- **Compound state selectors**: `.cardState.stateLearning {}` → both classes scoped. JSX: `` `${styles.cardState} ${styles.stateLearning}` ``.
- **`@keyframes` names**: Define in `animations.css`. Reference by name from any module (Vite resolves them globally).
- **`dangerouslySetInnerHTML` targets**: Use `:global(.class-name)` in the module.
- **Do not re-add a `style.css` root file.** The old monolith has been fully migrated.

---

## What to be careful about

- **Never put the API key in SQLite.** It goes in Stronghold only.
- **Normalize all frontend input** before it reaches a storage function. The `normalize_*` helpers in `src-tauri/src/normalize.rs` and `src-tauri/src/ai.rs` are the pattern.
- **Use transactions** for any write that touches more than one table (e.g., inserting a card and bumping the space's `updated_at`).
- **Don't add scheduler logic to Rust.** Scheduling is the frontend's job; the backend is a dumb persistence layer for FSRS state.
- **The `study_days` table has a NULL/non-NULL duality** — `space_id IS NULL` means the global streak row, `space_id = x` means a per-space row. The streak query handles this with `(?1 IS NULL AND space_id IS NULL) OR space_id = ?1`.
- **Error messages go to end users.** Keep them in plain English. Rust now returns structured `AppError` payloads, and the TypeScript IPC boundary maps them into typed frontend errors.
