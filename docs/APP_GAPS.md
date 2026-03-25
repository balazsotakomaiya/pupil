# App Gaps

Snapshot of the meaningful gaps still remaining in the current Pupil app, based on the shipped code and the Phase 1 / Phase 2 specs.

## 1. AI Generation is still a UI prototype

- The AI generate flow is renderer-only and mocked. [`AiGenerateScreen.tsx`](../apps/app/src/components/ai-generate/AiGenerateScreen.tsx) builds fake cards locally with a timeout instead of calling a real provider.
- There is no Rust-side `generate_cards` command yet, and the Tauri backend has no HTTP client or Stronghold integration. [`Cargo.toml`](../apps/app/src-tauri/Cargo.toml) only includes `tauri`, `rusqlite`, `serde`, and `nanoid`.
- Result: Chunk 5 is still not actually complete, even though the review/save UI exists.

## 2. AI settings are not implemented as specified

- AI settings are currently stored in renderer `localStorage`, not in Tauri Stronghold or the SQLite `settings` table. See [`ai-settings.ts`](../apps/app/src/lib/ai-settings.ts).
- The settings screen says this explicitly: Stronghold-backed secret storage and live provider testing are still pending. See [`SettingsScreen.tsx`](../apps/app/src/components/settings/SettingsScreen.tsx).
- The `Test` button is simulated. It only checks whether the API key field is non-empty and then returns a fake success label.
- The configured base URL/model are not driving any real generation request yet, because generation itself is still mocked.
- Result: Chunk 9 is still incomplete.

## 3. Space CRUD is only partially exposed in the UI

- The backend supports `rename_space` and `delete_space`. See [`lib.rs`](../apps/app/src-tauri/src/lib.rs).
- The frontend data layer also exposes rename/delete operations. See [`spaces.ts`](../apps/app/src/lib/spaces.ts).
- But the current UI only gives users a create-space flow. There is no visible rename/delete path in the dashboard or space detail screens.
- Result: the codebase has full space CRUD underneath, but the product surface does not.

## 4. Settings data actions are mostly placeholders

- `Export`, `Export CSV`, and `Reset All Data` are still presentation-only in the settings UI. See [`SettingsScreen.tsx`](../apps/app/src/components/settings/SettingsScreen.tsx).
- The settings page still claims review logs are not recorded yet and shows `0 reviews`, which is now inaccurate because review logs are persisted as part of study. This copy is stale.
- The SQLite `settings` table exists in the schema, but it is not the source of truth for the AI settings yet. See [`0001_init.sql`](../apps/app/src-tauri/migrations/0001_init.sql).

## 5. Dashboard activity is still synthetic

- The dashboard "Recent" list is still built from recently updated spaces, not from `review_logs`. See `buildActivity()` in [`App.tsx`](../apps/app/src/App.tsx).
- The "View all →" affordance in the activity panel is not wired to anything. See [`ActivitySection.tsx`](../apps/app/src/components/dashboard/ActivitySection.tsx).
- Result: the stats are now real, but the activity feed is still an approximation.

## 6. Import still has Phase 1 limitations

- `.apkg` media import is still skipped. Images/audio are not brought in.
- Anki review history is not transferred; imported cards start fresh under Pupil's FSRS state.
- Import history is renderer-managed instead of being persisted as first-class app data. See [`ImportScreen.tsx`](../apps/app/src/components/import/ImportScreen.tsx) and [`imports.ts`](../apps/app/src/lib/imports.ts).
- These are acceptable short-term tradeoffs, but they remain functional gaps relative to a fuller migration story.

## 7. Some surfaced controls are still inert or placeholder-grade

- The titlebar search button is visible, but there is no actual search flow wired from it.
- The settings "Docs", "GitHub", and "Issues" links are placeholder URLs pointing to generic GitHub locations, not Pupil-specific destinations. See `handleOpenExternal()` in [`SettingsScreen.tsx`](../apps/app/src/components/settings/SettingsScreen.tsx).

## 8. Testing and release hardening are still thin

- There are no automated tests in the app package today, only `typecheck` and `build`. See [`package.json`](../apps/app/package.json).
- The manual acceptance checklist in [`PHASE_1_SPEC.md`](./PHASE_1_SPEC.md) has not been turned into executable coverage.
- Result: core functionality is progressing, but regression protection is still weak.

## Recommended next order

1. Finish real AI provider integration end-to-end.
2. Implement Stronghold-backed settings persistence and live connection testing.
3. Add rename/delete space actions to the visible UI.
4. Replace synthetic dashboard activity with `review_logs`-driven activity.
5. Wire real export/reset flows and clean up stale settings copy.
6. Add a minimal automated test layer around imports, study scheduling, and stats queries.
