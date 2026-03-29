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
| Styling | CSS modules |
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
│   ├── layouts/            # Page-level layouts
│   └── lib/                # Frontend utilities and Tauri command wrappers
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Entry point — just calls lib::run()
│   │   └── lib.rs          # Everything: Tauri commands, DB logic, AI calls
│   ├── migrations/         # SQL schema files (applied in order at startup)
│   ├── capabilities/       # Tauri capability definitions (IPC permissions)
│   └── tauri.conf.json     # App metadata, window config, plugin config
└── references/             # Design reference files (not shipped)
```

---

## How the backend is organized

All Rust lives in a single `lib.rs`. The rough layering within that file is:

1. **Imports and type aliases** — at the top. `AppResult<T>` is the shared error wrapper.
2. **Data structs** — input types (`*Input`), output types (`*Summary`, `*State`), and normalized intermediates (`Normalized*`). Inputs come from the frontend (deserialized), outputs go back (serialized). Normalized types are internal-only.
3. **Constants** — FSRS limits, setting keys, AI prompt text, Stronghold identifiers, migration definitions.
4. **Tauri commands** (`#[tauri::command]`) — the public API the frontend calls. These are thin: they open a connection, normalize input, call a storage or business-logic function, and map errors. They do not contain query logic.
5. **`run()`** — wires the Tauri builder, registers all commands, and runs migrations on startup.
6. **Infrastructure helpers** — path resolution, connection opening, migration logic, backup creation.
7. **Settings and Stronghold** — reading/writing the `settings` table and the API key vault.
8. **AI layer** — prompt building, provider dispatch (OpenAI vs Anthropic), response parsing.
9. **Storage functions** — SQL queries, one per operation. Named `*_row` or `*_rows` by convention.
10. **Normalization functions** — input validation at the boundary. Named `normalize_*`.
11. **Utility functions** — `now_ms()`, `encode_tags`, `decode_tags`, `csv_escape`, error mappers.

---

## Adding a new Tauri command

1. Define the input struct (if needed) with `#[derive(Deserialize)]` and `#[serde(rename_all = "camelCase")]`.
2. Define the output struct with `#[derive(Serialize)]` and `#[serde(rename_all = "camelCase")]`.
3. Write the storage function (`fn do_thing_row(...)`) that does the SQL work.
4. Write the command function annotated with `#[tauri::command]`. It should: open a connection, normalize input, call the storage function, map errors to `String`.
5. Register the command in the `tauri::generate_handler![...]` list inside `run()`.
6. Add a corresponding TypeScript wrapper in `src/lib/` using `invoke`.

---

## Database conventions

- All IDs are `nanoid!(12)` — 12-character random strings.
- All timestamps are Unix milliseconds stored as `INTEGER`. Use `now_ms()` to get the current time.
- Tags are stored as a JSON array string in a nullable `TEXT` column. Use `encode_tags` / `decode_tags`.
- Schema changes go in a new file under `migrations/` named `NNNN_description.sql`. Add the new `Migration` entry to the `MIGRATIONS` slice in `lib.rs`.
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

---

## What to be careful about

- **Never put the API key in SQLite.** It goes in Stronghold only.
- **Normalize all frontend input** before it reaches a storage function. The `normalize_*` functions at the bottom of `lib.rs` are the pattern.
- **Use transactions** for any write that touches more than one table (e.g., inserting a card and bumping the space's `updated_at`).
- **Don't add scheduler logic to Rust.** Scheduling is the frontend's job; the backend is a dumb persistence layer for FSRS state.
- **The `study_days` table has a NULL/non-NULL duality** — `space_id IS NULL` means the global streak row, `space_id = x` means a per-space row. The streak query handles this with `(?1 IS NULL AND space_id IS NULL) OR space_id = ?1`.
- **Error messages go to end users.** Keep them in plain English. The `map_storage_error` and `map_card_storage_error` functions are the translation layer between SQLite error codes and user-facing strings.
