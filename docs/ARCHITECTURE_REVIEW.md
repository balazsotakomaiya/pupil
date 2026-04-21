# Architecture Review: Prototype → Production

> Snapshot: April 2026. Pupil v0.0.3, Phase 1 shipped.

Pupil works well as a concept and the fundamentals are sound — local-first SQLite, clean Tauri/React/Rust separation, real FSRS-5 scheduling, working Anki import. This document covers what needs to change to support a growing feature set, multiple contributors, and production-grade reliability.

---

## Table of contents

1. [The god component: App.tsx](#1-the-god-component-apptsx)
2. [State management](#2-state-management)
3. [Error handling — frontend](#3-error-handling--frontend)
4. [Error handling — backend](#4-error-handling--backend)
5. [Testing](#5-testing)
6. [Linting, formatting, and git hooks](#6-linting-formatting-and-git-hooks)
7. [CSS architecture](#7-css-architecture)
8. [Directory structure](#8-directory-structure)
9. [Large files to decompose](#9-large-files-to-decompose)
10. [Type safety across the IPC boundary](#10-type-safety-across-the-ipc-boundary)
11. [Documentation cleanup](#11-documentation-cleanup)
12. [CI guardrails](#12-ci-guardrails)
13. [Other production readiness items](#13-other-production-readiness-items)
14. [Recommended priority order](#14-recommended-priority-order)

---

## Progress update

**Update: April 19, 2026**

- Landed: repo guardrails via `biome.json`, `lefthook.yml`, workspace lint/test scripts, and CI lint/test jobs in `.github/workflows/build.yml`.
- Landed: first test layer via `apps/app/vitest.config.ts`, Vitest coverage for `fsrs`, `study-settings`, and extracted derived-state helpers, plus Rust unit tests in `normalize.rs` and `util.rs`.
- Landed: `App.tsx` decomposition now has three concrete slices in place. Empty-state seed data lives in `src/lib/seed-data.ts`, derived-state builders live in `src/lib/derived.ts`, and app-wide bootstrap/data/mutation state now lives in `src/lib/app-store.ts`.
- Landed: `App.tsx` is down from 1,216 lines to 611 lines after moving bootstrap loading, entity snapshots, card/space mutations, reset flow, and study-settings persistence into the Zustand store.
- Landed: TanStack Router now owns the app's in-memory navigation flow, and TanStack Query is in place for app-data fetching and mutation invalidation.
- Landed: frontend error boundaries, typed IPC error mapping, and toast-style notifications now provide crash recovery and consistent user feedback.
- Landed: the Rust backend now returns structured `AppError` payloads and writes tracing/panic output to rotating log files.
- Landed: CSS Modules are now available and in use for the new error/notification surfaces, with tokens/reset/utilities split out into `src/styles/`.
- Landed: prototype HTML references were archived under `docs/design-references/`, and `src/sqljs.d.ts` moved into `src/types/sqljs.d.ts`.

---

## 1. The god component: App.tsx

**File:** `apps/app/src/App.tsx` — **611 lines** as of April 19, 2026, down from **1,216 lines**.

This is the single most important refactor target. `App.tsx` currently serves as:

- **Router.** A manual `activeTab` string state plus `selectedSpaceId`, `studySession`, `aiGenerateSession`, and `importSession` state objects determine which screen renders. There is no URL-based routing — screens are switched by setting state variables in callbacks.
- **UI/navigation state host.** `activeTab`, `selectedSpaceId`, `studySession`, `aiGenerateSession`, `importSession`, onboarding flags, dialog state, and command palette visibility still live here.
- **Screen orchestrator.** `App.tsx` still selects the active screen, fans store data/actions out as props, and owns follow-up UI transitions after mutations (closing modals, selecting a space, starting a study session, etc.).
- **Derived state computer.** ~80 lines of `const` computations derive display-ready data from raw state on every render: `studySummary`, `stats`, `spaceCards`, `activity`, `streakCells`, `newCardsBudget`, etc.
- **Event listener setup.** Three separate `useEffect` hooks register Tauri event listeners (`developer://reset-onboarding`, `tray://study-now`) and a global keyboard shortcut (Cmd+K).

Every new feature adds more state, more handlers, and more derived computations to this file. It is already at the limit of what a single developer can reason about.

### What to do

**Status:** In progress. `src/lib/seed-data.ts`, `src/lib/derived.ts`, and `src/lib/app-store.ts` now absorb the empty-state data, derived state helpers, bootstrap loading, app-wide entity snapshots, and most mutations. Routing and the remaining UI/navigation orchestration are still in `App.tsx`.

**Introduce TanStack Router.** Replace the five interdependent navigation variables (`activeTab`, `selectedSpaceId`, `studySession`, `aiGenerateSession`, `importSession`) with TanStack Router. It offers first-class TypeScript inference for route params — route definitions are typed end-to-end so `useParams()` returns the exact shape declared in the route config, with no casting. For a desktop app with no real URLs, `createMemoryHistory()` keeps routing entirely in memory with no address bar concerns. Screens become routes with typed params:

```typescript
const studyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/study/$scope/$spaceId",
  // params.spaceId is string | undefined — inferred, not cast
});
```

"Where am I" becomes a single route location rather than five correlated state variables, and navigation becomes `router.navigate({ to: "/study/$scope/$spaceId", params: { scope: "space", spaceId: id } })` instead of calling multiple setters.

**Done: move seed/fallback data** into `src/lib/seed-data.ts`. These are rendering constants, not application logic.

**Done: move derived state builders** (`buildStudySummary`, `buildStats`, `buildSpaceCards`, `buildActivity`, `buildStreakCells`, `sortCardRecords`, `shouldShowDailyCheckInPrompt`) into `src/lib/derived.ts`.

**Done: move bootstrap and mutation handlers** into the Zustand store in `src/lib/app-store.ts`. Card/space mutations, full refreshes, bootstrap loading, reset, and study-settings persistence no longer belong in `App.tsx`.

**Next: remove screen orchestration from `App.tsx`.** The remaining `handleDeleteSpace`, `handleSaveApprovedAiCards`, and study-session/navigation flows are mostly UI transitions. They should shrink further once routes own location state and screens can read the store directly.

**Target:** `App.tsx` should be ~100–150 lines: bootstrap, router, layout shell.

---

## 2. State management

### Current pattern

**Status:** The first Zustand slice has landed. `src/lib/app-store.ts` now owns app-wide data state (`spaces`, `cards`, `dashboardStats`, `recentActivity`, `spaceStats`, `studySettings`), bootstrap loading, and the main mutation actions. `App.tsx` still pulls those slices with `useAppStore(...)` and drills them into screens.

The old pattern was a wall of `useState` hooks plus a single `refreshAppData()` function in `App.tsx` that re-fetched **all** entities after most mutations. That looked like:

```typescript
async function refreshAppData() {
  const [nextSpaces, nextCards, nextDashboardStats, nextSpaceStats, nextRecentActivity, nextStudySettings] =
    await Promise.all([
      listSpaces(),
      listCards(),
      getDashboardStats(),
      listSpaceStats(),
      listRecentActivity(),
      getStudySettings(),
    ]);
  setSpaces(nextSpaces);
  setCards(nextCards);
  setDashboardStats(nextDashboardStats);
  setRecentActivity(nextRecentActivity);
  setSpaceStats(nextSpaceStats);
  setStudySettings(nextStudySettings);
  void refreshTrayStatus();
}
```

The new store is an improvement, but the architecture is still in transition: screens do not subscribe to the store directly yet, and some actions still refresh broader snapshots than they eventually should.

### Problems

- **Prop drilling.** `StudyScreen`, `CardsScreen`, `SettingsScreen`, etc. receive long prop lists (data + mutation callbacks). Adding a new piece of shared state means threading it through every intermediate component.
- **Store usage is centralized too high.** `App.tsx` selects nearly the entire store and redistributes it downward, so the store reduced data plumbing but has not yet eliminated prop drilling.
- **Refresh granularity is better, but still uneven.** Card updates now refresh targeted slices, while heavier flows like reset/import still reload larger snapshots. That is fine for now, but the refresh map should keep getting more precise.
- **No formal optimistic-update strategy.** The store now owns the data transitions, but optimistic updates and rollback behavior are still ad-hoc rather than standardized.
- **Navigation state is still separate from app data state.** Until routes own location, there is still a split brain between local screen-selection state and the centralized store.

### What to do

**Status:** Landed. Zustand fits the codebase well and the initial store confirms the direction:

- Tiny (~1KB), no boilerplate, works natively with async/await for Tauri IPC.
- Components subscribe to slices of state, so a card edit only re-renders components that read cards.
- Actions live inside the store, so mutation logic is colocated with the state it modifies.
- No providers or context wrappers needed.

```typescript
// Sketch — not prescriptive
const useAppStore = create<AppStore>((set, get) => ({
  spaces: [],
  cards: [],
  dashboardStats: null,

  createCard: async (input) => {
    const created = await createCard(input);
    set((state) => ({ cards: sortCardRecords([created, ...state.cards]) }));
    // Refresh only affected slices
    const [stats, spaceStats] = await Promise.all([getDashboardStats(), listSpaceStats()]);
    set({ dashboardStats: stats, spaceStats });
  },
  // ...
}));
```

**Next: move store reads closer to the screens that need them.** `App.tsx` should stop selecting the full app slice. Let feature screens or small feature hooks subscribe to the store directly so shared state stops flowing through the shell component.

**Granular refresh.** After a card mutation, refetch only the affected slices. After an import, refetch everything. After a settings change, refetch nothing (the mutation already returns the new value). The new store is the right place to encode that action-to-refresh map.

**Formalize optimistic updates.** Where the IPC call takes noticeable time (card review, AI generation), update local state immediately and reconcile when the response arrives. Roll back on error.

**Split the store once it grows.** `app-store.ts` is the right transitional step, but if it keeps accreting unrelated concerns, split it into slices or feature stores (`cards`, `spaces`, `settings`, notifications) before it becomes the next god object.

---

## 3. Error handling — frontend

### Current pattern

Each screen component manages its own error state:

```typescript
const [error, setError] = useState<string | null>(null);

try {
  const result = await someIpcCall();
} catch (error: unknown) {
  setError(error instanceof Error ? error.message : "Something went wrong");
}
```

Error messages are displayed inline as text within the component that caught them. There are no React Error Boundaries anywhere in the app. If a component throws during render (e.g., accessing a property on `null` after a failed fetch), the entire app white-screens with no recovery path.

### Problems

- **No crash recovery.** A single render error in any component takes down the entire app.
- **Inconsistent error display.** Some screens use `error` (string), others use `runtimeError`, others use `isError` + `errorDetail`. There is no consistent pattern for how errors look or where they appear.
- **No user-facing feedback for success.** Operations like "card saved", "import complete", "settings updated" rely on component-local state flags (`recentlySaved`, `isImportComplete`) with no shared notification system.
- **No retry affordances.** Only the AI generation screen offers a "retry" button. Other screens show a static error message.

### What to do

**Add React Error Boundaries.** Wrap each screen in an error boundary that catches render errors and shows a recovery UI ("Something went wrong. Go back to dashboard."). Add a top-level boundary as a last resort. React 19 still requires class-based error boundaries or a library like `react-error-boundary`.

```
<AppErrorBoundary>
  <ScreenErrorBoundary screen="study">
    <StudyScreen />
  </ScreenErrorBoundary>
</AppErrorBoundary>
```

**Define a class-based error hierarchy.** Rather than a flat union type, use a base class extended by tier-specific subclasses. This lets TypeScript enforce the contract at the type level and allows cross-cutting behaviours to be added as mixins.

```typescript
// src/lib/errors.ts

// --- Base ---
export abstract class AppError extends Error {
  abstract readonly severity: "fatal" | "domain" | "infra";
  abstract readonly code: string;
}

// --- Tiers ---
export abstract class DomainError extends AppError {
  readonly severity = "domain" as const;
}

export abstract class InfraError extends AppError {
  readonly severity = "infra" as const;
}

export abstract class FatalError extends AppError {
  readonly severity = "fatal" as const;
}

// --- Concrete domain errors ---
export class ValidationError extends DomainError {
  readonly code = "VALIDATION" as const;
  constructor(message: string, readonly field?: string) { super(message); }
}

export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND" as const;
  constructor(readonly entity: string) { super(`${entity} not found`); }
}

export class DuplicateError extends DomainError {
  readonly code = "DUPLICATE" as const;
  constructor(readonly entity: string) { super(`${entity} already exists`); }
}

// --- Concrete infra errors ---
export class StorageError extends InfraError {
  readonly code = "STORAGE" as const;
}

export class AiProviderError extends InfraError {
  readonly code = "AI_PROVIDER" as const;
  constructor(message: string, readonly detail?: string) { super(message); }
}

// --- Concrete fatal errors ---
export class MigrationFailedError extends FatalError {
  readonly code = "MIGRATION_FAILED" as const;
}
```

**Add a `Reportable` mixin for cross-cutting concerns.** Not every error needs to go to logs or telemetry — a `ValidationError` is expected and uninteresting; a `StorageError` or `MigrationFailedError` should always be captured. A mixin expresses this without forcing it into the class hierarchy:

```typescript
// The mixin interface
interface Reportable {
  readonly reportable: true;
  toReport(): { code: string; severity: string; message: string; context?: Record<string, unknown> };
}

// The mixin factory — applies to any AppError subclass
function withReportable<TBase extends new (...args: any[]) => AppError>(Base: TBase) {
  return class extends Base implements Reportable {
    readonly reportable = true as const;
    toReport() {
      return { code: this.code, severity: this.severity, message: this.message };
    }
  };
}

// Apply to the error classes that warrant it
export class StorageError extends withReportable(InfraError) {
  readonly code = "STORAGE" as const;
}

export class MigrationFailedError extends withReportable(FatalError) {
  readonly code = "MIGRATION_FAILED" as const;
}

// Type guard usable anywhere
export function isReportable(error: AppError): error is AppError & Reportable {
  return "reportable" in error && (error as any).reportable === true;
}
```

The error-handling pipeline then becomes:

```typescript
function handleError(error: AppError) {
  if (isReportable(error)) captureToLog(error.toReport());

  switch (error.severity) {
    case "fatal":  navigate("/error", { state: error }); break;
    case "infra":  notify({ type: "error", error, retryable: true }); break;
    case "domain": notify({ type: "error", error }); break;
  }
}
```

Other mixins follow the same pattern as needs arise — `Retryable` (infra errors with a retry action), `UserFacing` (errors with a polished user message distinct from the internal one), etc.

Map backend `Err(String)` IPC responses into this hierarchy at the boundary in `src/lib/ipc.ts`, so no error string ever leaks past the data layer.

**Add a toast/notification system.** A small global notification store (can live in Zustand) that any component or store action can push to: `notify({ type: "success", message: "Card saved" })` or `notify({ type: "error", error })`. The notification component renders based on `error.severity`. This replaces per-component `recentlySaved` / `error` state and gives users consistent visual feedback across the whole app.

---

## 4. Error handling — backend

### Current pattern

Tauri commands return `Result<T, String>`. Internal functions use `AppResult<T> = Result<T, Box<dyn Error>>`. Error mapping functions in `util.rs` translate rusqlite errors into user-facing strings:

```rust
pub(crate) fn map_storage_error(error: rusqlite::Error) -> String {
    match error {
        rusqlite::Error::SqliteFailure(e, _) if e.extended_code == 2067 =>
            "A space with that name already exists.".to_string(),
        rusqlite::Error::QueryReturnedNoRows =>
            "Space not found.".to_string(),
        other => other.to_string(),
    }
}
```

Every command handler does `.map_err(|error| error.to_string())` or `.map_err(map_storage_error)`.

### Problems

- **No structured error types.** All errors are flattened to strings at the command boundary. The frontend cannot distinguish "not found" from "constraint violation" from "disk full" without parsing the message text.
- **No logging.** There is zero observability into what the Rust layer is doing. No `tracing`, no `log`, no `println!`. If a user reports a bug, there is no way to ask for logs.
- **Repetitive error mapping.** Every command handler repeats `.map_err(|error| error.to_string())`. This is noise that obscures the actual logic.
- **`Box<dyn Error>` erases context.** The internal `AppResult` type discards error provenance. You cannot inspect what kind of error occurred without downcasting.

### What to do

**Define a structured error enum with `thiserror`, mirroring the frontend taxonomy:**

```rust
#[derive(Debug, thiserror::Error, serde::Serialize)]
#[serde(tag = "code", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AppError {
    // Domain errors — expected failure states in business logic
    #[error("Validation: {message}")]
    Validation { message: String, field: Option<String> },

    #[error("{entity} not found")]
    NotFound { entity: String },

    #[error("{entity} already exists")]
    Duplicate { entity: String },

    // Infrastructure errors — external system failures
    #[error("Storage error: {0}")]
    Storage(#[from] #[serde(skip)] rusqlite::Error),

    #[error("Network error: {0}")]
    Network(#[from] #[serde(skip)] reqwest::Error),

    #[error("AI provider error: {message}")]
    AiProvider { message: String, detail: Option<String> },

    // Fatal errors — unrecoverable app state
    #[error("Migration failed: {0}")]
    MigrationFailed(String),
}
```

By deriving `serde::Serialize` with `tag = "code"`, Tauri serializes the error as `{ "code": "NOT_FOUND", "entity": "space" }` rather than a flat string. The frontend receives a structured object it can match on, and the `severity` can be derived from `code` using the same taxonomy as the frontend error types. No more `error.message.includes("not found")` in TypeScript.

**Add `tracing`.** It is the standard Rust ecosystem crate for structured logging. Set up a `tracing-subscriber` that writes to a rotating log file in the app data directory. Use `#[instrument]` on command handlers for automatic span creation. This gives you debug logs for free:

```rust
#[tauri::command]
#[tracing::instrument(skip(app))]
pub(crate) fn create_card(app: AppHandle, input: CreateCardInput) -> Result<CardSummary, AppError> {
    // ...
}
```

**Add a panic hook.** Set `std::panic::set_hook` in `lib.rs` to log panics to the log file and optionally write a crash report. Without this, panics in background threads silently disappear.

---

## 5. Testing

### Current state

This is no longer zero-state. As of April 19, 2026:

- Vitest is wired into `apps/app` via `apps/app/vitest.config.ts`.
- TypeScript tests cover `fsrs.ts`, `study-settings.ts`, and `derived.ts`.
- Rust unit tests cover `normalize.rs` and `util.rs`.

Coverage is still intentionally thin, but there is now an executable baseline instead of relying entirely on manual acceptance checks.

### What to test and how

The goal is not 90% coverage — it is protecting the logic that, if broken, would silently corrupt user data or produce wrong study schedules.

#### Rust unit tests (built-in `#[cfg(test)]`)

These are the highest-value, lowest-effort tests. No extra tooling needed.

| Module | What to test | Why it matters |
|--------|-------------|----------------|
| `normalize.rs` | Every normalization function: empty input, whitespace-only, boundary lengths, valid/invalid grades, negative timestamps, tag deduplication | This is the input boundary. If it passes bad data, it corrupts the database. |
| `util.rs` | `encode_tags` / `decode_tags` round-trip, `map_storage_error` for each SQLite error variant, `now_ms` returns a reasonable timestamp | Tag encoding bugs silently lose data. |
| `imports.rs` | Anki card normalization, deck name extraction, duplicate detection logic | Import is hard to manually test — many edge cases in `.apkg` structure. |
| `ai.rs` | Prompt construction (`build_generate_cards_prompt`), response parsing (`parse_generated_cards_response`) with valid JSON, malformed JSON, partial JSON | AI responses are unpredictable. The parser must be robust. |

#### Rust integration tests (in-memory SQLite)

```rust
#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        // Run all migrations
        conn.execute_batch(include_str!("../migrations/0001_init.sql")).unwrap();
        conn.execute_batch(include_str!("../migrations/0002_add_learning_steps.sql")).unwrap();
        conn.execute_batch(include_str!("../migrations/0003_add_suspended.sql")).unwrap();
        conn
    }
}
```

Test card CRUD, space CRUD, cascading deletes, review logging, analytics queries, and migration ordering. These catch schema drift and SQL bugs that the type system cannot.

#### TypeScript unit tests (Vitest)

Add `vitest` as a dev dependency in `apps/app`. Create `vitest.config.ts`:

| Module | What to test |
|--------|-------------|
| `fsrs.ts` | Scheduling computation for each grade (1–4), state transitions (New → Learning → Review → Relearning), interval calculations |
| `imports.ts` | `.apkg` ZIP parsing, note extraction, field splitting, deck hierarchy flattening |
| `study-settings.ts` | `computeNewCardsBudget` with various limit/today combinations, edge cases (unlimited, 0, negative) |
| `derived.ts` (once extracted) | `buildStudySummary`, `buildStats`, `buildSpaceCards`, streak cell generation |
| `activity.ts` | Session grouping logic, time label formatting |

These are pure functions with no Tauri dependency, so they test trivially.

#### TypeScript component tests (Vitest + Testing Library)

Lower priority, but valuable for:

- `StudyScreen`: keyboard shortcuts (Space to reveal, 1–4 to grade, Esc to exit), grade button rendering, session summary at zero cards
- `CardFormPanel`: validation (empty front/back), tag parsing
- `ImportScreen`: drop zone behavior, progress card rendering

#### End-to-end (later)

Playwright or Tauri's built-in WebDriver support. Full flows: create space → add card → study → review → check stats. Worth doing once the unit/integration layer is stable.

#### Wiring

Add a `test` script to `apps/app/package.json` pointing to `vitest run`. Add `cargo test` to the root `test` script. Wire both into CI (see [section 12](#12-ci-guardrails)).

---

## 6. Linting, formatting, and git hooks

### Current state

This has been partially addressed as of April 19, 2026:

- Biome is configured at the repo root in `biome.json`.
- Workspace lint/test scripts now exist in the root and app packages.
- Lefthook is configured via `lefthook.yml` and installed through the root `prepare` script.
- Rust formatting and linting are available via `cargo fmt` and `cargo clippy` scripts and are wired into CI.

The baseline is intentionally conservative for now: a11y-heavy/icon-heavy UI patterns and some legacy surfaces are not yet fully lint-clean under stricter rule sets. That cleanup still belongs on the roadmap, but the repo now has enforceable guardrails instead of none.

### What to do

**Biome** (recommended over ESLint + Prettier). It is a single tool that handles both linting and formatting for TypeScript, TSX, and JSON. It is significantly faster than ESLint and requires near-zero configuration. Add a `biome.json` at the repository root:

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.0.x/schema.json",
  "organizeImports": { "enabled": true },
  "formatter": {
    "indentStyle": "tab", // or "space" — match current convention
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  }
}
```

**Cargo Clippy + Cargo Fmt.** Both are already installed with the Rust toolchain. Add them to CI as blocking checks:

```yaml
- run: cargo clippy --manifest-path apps/app/src-tauri/Cargo.toml -- -D warnings
- run: cargo fmt --manifest-path apps/app/src-tauri/Cargo.toml --check
```

**Git hooks via Lefthook** (lighter and faster than Husky, works natively with Bun). Install with `bun add -d @evilmartians/lefthook` and add a `lefthook.yml`:

```yaml
pre-commit:
  parallel: true
  commands:
    biome:
      glob: "*.{ts,tsx,json}"
      run: bunx biome check --write --staged {staged_files}
    cargo-fmt:
      glob: "*.rs"
      run: cargo fmt --manifest-path apps/app/src-tauri/Cargo.toml
```

This ensures every commit is formatted and lint-clean without requiring developer discipline.

---

## 7. CSS architecture

### Current state

`apps/app/src/style.css` is a **7,061-line** monolith. It contains:

- CSS custom properties (design tokens) for colors, spacing, typography
- A CSS reset and base typography
- Layout utilities and grid systems
- Every component's styles, from dashboard cards to study buttons to settings forms to import dropzones

The design system is well-documented in `DESIGN.md` and the token values are good. The problem is purely structural — a single file does not scale.

### What to do

**Split into CSS Modules.** Vite supports CSS Modules natively with zero configuration. Each component directory gets a colocated `.module.css` file:

```
src/
  styles/
    tokens.css          # CSS custom properties only
    reset.css           # Base reset, typography, global defaults
    utilities.css       # Shared utility classes (if any)
  components/
    study/
      StudyScreen.tsx
      StudyScreen.module.css
      StudyReviewCard.tsx
      StudyReviewCard.module.css
    settings/
      SettingsScreen.tsx
      SettingsScreen.module.css
```

**Extract design tokens first.** Pull out the `:root { ... }` block and all CSS custom property definitions into `src/styles/tokens.css`. This becomes the single source of truth for the design system. Import it in `main.tsx` or `App.tsx`. All component modules reference token variables (e.g., `var(--bg-secondary)`) but do not redefine them.

**Do this incrementally.** Move one component at a time. The global `style.css` shrinks with each extraction. No big-bang rewrite needed.

---

## 8. Directory structure

The current layout is mostly clean, but there is some prototype-era debt.

### `references/` — 9 static HTML mockups

`apps/app/references/` contains `aigen.html`, `cards.html`, `import.html`, `newcard.html`, `onboarding.html`, `palette.html`, `settings.html`, `spacedetails.html`, `study.html`. These are static design mockups from the prototyping phase. The live React components have replaced them.

**Action:** Move to `docs/design-references/` for archival, or delete entirely if the live components are the source of truth. They should not live alongside production source code.

### `packages/` is empty

The workspace root declares `packages/*` as a workspace, but the directory is empty.

**Action:** Either delete it and remove from root `package.json` workspaces, or create the first shared package now (e.g., `@pupil/types` for shared type definitions — see [section 10](#10-type-safety-across-the-ipc-boundary)).

### `src/lib/` is a flat grab-bag

15 files sit in a single directory with no grouping:

```
activity.ts    ai-settings.ts    app-version.ts    bootstrap.ts
cards.ts       daily-checkin.ts   data-actions.ts   fsrs.ts
imports.ts     onboarding.ts      runtime.ts        spaces.ts
stats.ts       study-settings.ts  tray.ts
```

As more features are added (search, media, sync), this flat list becomes unnavigable.

**Action:** Group by domain:

```
src/lib/
  data/           # cards.ts, spaces.ts, stats.ts, activity.ts, imports.ts
  study/          # fsrs.ts, study-settings.ts
  ai/             # ai-settings.ts
  platform/       # runtime.ts, bootstrap.ts, tray.ts, app-version.ts
  ui/             # onboarding.ts, daily-checkin.ts, data-actions.ts
```

Alternatively, keep it flat but rename for alphabetical grouping: `data-cards.ts`, `data-spaces.ts`, `data-stats.ts`, etc. The exact structure matters less than having one and being consistent.

### Barrel exports are inconsistent

Some component directories have `index.ts` barrel exports (`ai-generate`, `app-shell`, `dashboard`), others do not (`study`, `cards`, `settings`, `space-details`, `onboarding`, `import`).

**Action:** Standardize. Either every component directory has an `index.ts` that re-exports its public API, or none do and consumers import from specific files. Mixed is confusing.

### `src/sqljs.d.ts`

A single type declaration file sitting at the `src/` root.

**Action:** Move to `src/types/sqljs.d.ts` if you create a types directory, or to `src/lib/platform/` where the sql.js runtime fallback logic lives.

---

## 9. Large files to decompose

| File | Lines | Problem | Action |
|------|-------|---------|--------|
| `App.tsx` | 1,216 | See [section 1](#1-the-god-component-apptsx) in full | Router + store + layout shell |
| `style.css` | 7,061 | See [section 7](#7-css-architecture) in full | CSS Modules |
| `SettingsScreen.tsx` | 917 | Combines AI settings form (with debounced auto-save, connection test, provider detection), study settings card, and data actions (export, reset) in a single component | Extract `AiSettingsSection.tsx`, `StudySettingsSection.tsx`, `DataActionsSection.tsx`. The 1.5s debounced auto-save logic should become a `useAutoSave` hook. |
| `CardsScreen.tsx` | 441 | Acceptable size, but the inline create/edit form could be cleaner | Extract `CreateCardDialog.tsx` if it grows further |
| `StudyScreen.tsx` | 406 | The session summary view at the end is a distinct UI | Extract `StudySessionSummary.tsx` |
| `AiGenerateScreen.tsx` | 389 | State machine (form → loading → review → error) is manageable | Extract `AiGenerateReview.tsx` if it grows |
| `ai.rs` | 801 | Combines settings persistence, Stronghold integration, HTTP client calls, prompt construction, and response parsing | Split into `ai/settings.rs`, `ai/generate.rs`, `ai/providers.rs` (or at minimum extract prompt construction and response parsing into `ai/prompts.rs`) |
| `commands.rs` | 350 | Thin wrappers, but the file will grow with every new command | Acceptable for now. If it exceeds ~500 lines, split into `commands/spaces.rs`, `commands/cards.rs`, etc. |
| `types.rs` | 340 | All IPC input/output types in one file | Acceptable for now. Split if it exceeds ~500 lines. |

---

## 10. Type safety across the IPC boundary

### Current pattern

Types are manually duplicated between TypeScript and Rust. For example:

**TypeScript** (`cards.ts`):
```typescript
export type CardRecord = {
  id: string;
  spaceId: string;
  front: string;
  back: string;
  tags: string[];
  source: CardSource;
  state: number;
  due: number;
  stability: number;
  difficulty: number;
  // ...
};
```

**Rust** (`types.rs`):
```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CardSummary {
    pub(crate) id: String,
    pub(crate) space_id: String,
    pub(crate) front: String,
    pub(crate) back: String,
    pub(crate) tags: Vec<String>,
    pub(crate) source: String,
    pub(crate) state: i64,
    pub(crate) due: i64,
    pub(crate) stability: f64,
    pub(crate) difficulty: f64,
    // ...
}
```

These are kept in sync by convention. If someone adds a field to the Rust struct and forgets to add it to the TypeScript type, the frontend silently ignores the new field (or breaks if it tries to access a removed one).

### What to do

**Short term: Schema validation tests.** Write a Vitest test that mocks or invokes each Tauri command and validates the response shape using Zod schemas derived from the TypeScript types. This catches drift at test time.

**Long term: Auto-generate TypeScript types from Rust.** Two options:

- **`specta`** — specifically designed for Tauri. Add `#[specta::specta]` derives to Rust types and it generates `.d.ts` files at build time. Tauri v2 compatible.
- **`typeshare`** — more general, works by annotating Rust structs with `#[typeshare]` and running a CLI to emit TypeScript.

Either approach eliminates the manual duplication and makes type drift impossible.

---

## 11. Documentation cleanup

| Document | Current status | Action |
|----------|---------------|--------|
| `docs/PHASE_1_SPEC.md` | Phase 1 is shipped. The file is redundant with the current app/docs state. | Delete the file and fold any still-useful notes into the current docs set. |
| `docs/PHASE_2_SPEC.md` | Next iteration plan. | Keep active. Ensure it reflects current priorities. |
| `docs/APP_GAPS.md` | Lists known gaps. Sections 4 and 5 are marked "Recently closed" but the content below still describes them as open. | Update or remove closed sections. Migrate remaining actionable items to GitHub Issues so they are trackable. The doc goes stale quickly. |
| `apps/app/DESIGN.md` | Excellent design system documentation. | Keep. Ensure CSS token values in `style.css` (or extracted `tokens.css`) match what is documented here. |
| `apps/app/AGENTS.md` | Excellent agent/developer guide. | Keep. Update directory paths if you restructure `src/lib/`. |
| `apps/site/DESIGN.md` | Marketing site design. | Review for currency. |
| `docs/RELEASING.md` | Release process. | Review for currency. |
| `apps/app/references/*.html` | 9 static HTML mockups from prototyping. | Move to `docs/design-references/` or delete. |
| `BUILDING.md` | Build instructions. | Keep. Ensure it covers the new lint/test/format steps once added. |

---

## 12. CI guardrails

### Current state

Two GitHub Actions workflows exist:

- **`build.yml`** — Builds on push to `main` and PRs. Matrix: Ubuntu 22.04, Windows latest, macOS (Intel + Apple Silicon). Runs `tauri build --ci --no-sign`.
- **`publish.yml`** — Triggered on `app-v*` tags. Publishes to GitHub Releases.

This has now started changing. `build.yml` includes dedicated `lint` and `test` jobs as of April 19, 2026, and the build matrix depends on those jobs passing first.

### What to add

**Lint job** (add to `build.yml`):

```yaml
lint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v2
    - run: bun install --frozen-lockfile
    - run: bunx biome ci .
    - run: bun run typecheck
    - uses: dtolnay/rust-toolchain@stable
      with: { components: clippy, rustfmt }
    - run: cargo clippy --manifest-path apps/app/src-tauri/Cargo.toml -- -D warnings
    - run: cargo fmt --manifest-path apps/app/src-tauri/Cargo.toml --check
```

**Test job** (add to `build.yml`):

```yaml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v2
    - run: bun install --frozen-lockfile
    - run: bun run test
    - uses: dtolnay/rust-toolchain@stable
    - run: cargo test --manifest-path apps/app/src-tauri/Cargo.toml
```

**Dependency audit** (optional but recommended):

```yaml
audit:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: cargo install cargo-audit
    - run: cargo audit --manifest-path apps/app/src-tauri/Cargo.toml
```

**Bundle size tracking** (optional). Use `vite-bundle-analyzer` or a GitHub Action that comments on PRs with bundle size changes. Catches accidental dependency bloat early.

---

## 13. Other production readiness items

### Logging and observability

There is currently zero logging in both the Rust backend and the TypeScript frontend. If a user reports a bug, there is no way to ask for logs or reproduce the state.

**Rust:** Add `tracing` + `tracing-subscriber` with a file appender that writes to `{app_data_dir}/logs/`. Use `tracing::info!`, `tracing::warn!`, `tracing::error!` at key points: command entry/exit, migration runs, AI API calls, errors. Use `#[instrument]` on command handlers.

**TypeScript:** Create a thin `src/lib/log.ts` wrapper that writes to `console` in development and (optionally) sends structured events to the backend via a Tauri command for persistent logging.

### Crash recovery

**Rust panics:** Set a custom panic hook in `lib.rs` that writes the panic info to the log file before the process exits. Without this, panics in background threads silently disappear.

**React crashes:** Error Boundaries (see [section 3](#3-error-handling--frontend)) catch render errors. For unhandled promise rejections, add a `window.addEventListener("unhandledrejection", ...)` handler that logs and shows a toast.

### Database migrations

Currently, migrations are hardcoded as string slices in `constants.rs` and run sequentially at startup. This is fine for 3 migrations, but will become unwieldy at 10+.

**Short term:** Keep the current approach but add integration tests that verify migration ordering and idempotency.

**Long term:** Consider `refinery` (Rust migration runner) or `sqlx` (compile-time checked SQL) if migrations grow complex or you need rollback support.

### Keyboard shortcuts

Shortcuts are currently defined inline in multiple components:

- `App.tsx`: Cmd+K (command palette)
- `StudyScreen.tsx`: Space (reveal), 1–4 (grade), Esc (exit)
- Various components: Enter (submit forms)

**Action:** Centralize in a `src/lib/shortcuts.ts` registry. Create a `useShortcuts` hook that registers/unregisters handlers and prevents conflicts. Display the canonical shortcut list in settings from this registry (currently hardcoded in `SettingsScreen`).

### Accessibility

No ARIA roles, no focus management, no keyboard navigation for lists, no focus trapping in dialogs.

**Minimum viable a11y:**

- Add `role="dialog"` and `aria-modal="true"` to dialogs (new space, delete confirmation, etc.)
- Trap focus inside open dialogs
- Add `aria-label` to icon-only buttons (titlebar actions, card action buttons)
- Ensure keyboard navigation works for card lists and space cards (arrow keys, Enter to select)
- Test with VoiceOver on macOS

### Web fallback mode abstraction

Every file in `src/lib/` has branching logic:

```typescript
if (isTauriRuntime()) {
  return invoke("list_cards", ...);
} else {
  // localStorage + sql.js fallback
}
```

**Action:** Define a `DataProvider` interface with `TauriDataProvider` and `WebDataProvider` implementations. Initialize the correct one at bootstrap and inject it via context or the store. This eliminates all runtime checks, makes the web fallback testable in isolation, and makes it possible to add new backends (e.g., a cloud sync provider) without touching existing code.

### Internationalization

English-only currently. Not urgent, but worth structuring for:

**Action:** Extract user-visible strings into constant objects colocated with their components. Even without a full i18n library, this makes future translation possible without grep-and-replace across every `.tsx` file.

---

## 14. Recommended priority order

Most of the initial foundation work is now landed. From the current snapshot, this is the recommended next sequence:

| # | Item | Effort | Unblocks |
|---|------|--------|----------|
| 1 | **TanStack Router shell** (memory history, typed route params, screen routes) | Medium | Removes state-based navigation tangle, shrinks `App.tsx` further |
| 2 | **Finish the Zustand migration** (screen-level subscriptions or feature hooks instead of drilling store slices through `App.tsx`) | Medium | Eliminates the remaining shell-level prop plumbing |
| 3 | **Error boundaries + toast system** | Small | Crash recovery, consistent user feedback, shared async UX |
| 4 | **CSS Modules / style extraction** (incremental move out of `style.css`) | Medium | Maintainable component styling as the screen count grows |
| 5 | **Decompose large files** (`SettingsScreen`, backend `ai.rs`, other 300+ line files) | Small | Keeps feature work navigable as contributors increase |
| 6 | **Rust error enum + `thiserror` + tracing** | Medium | Structured backend errors and better observability |
| 7 | **IPC type safety** (boundary validation first, then `specta`/`typeshare` if still useful) | Medium | Eliminates frontend/backend type drift |
| 8 | **Directory restructure** (`lib/` grouping, feature barrels, archive references) | Small | Makes the post-router/store codebase easier to navigate |
| 9 | **Documentation cleanup** (archive older planning docs, sync `APP_GAPS`, update contributor docs) | Small | Keeps the project docs aligned with the codebase |
| 10 | **Accessibility pass** (dialogs, focus management, keyboard nav) | Medium | Inclusive UX and fewer interaction regressions |
| 11 | **Web fallback abstraction** (`DataProvider` interface) | Medium | Clean platform separation and easier future sync work |
