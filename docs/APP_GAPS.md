# App Gaps

Snapshot of the meaningful gaps still remaining in the current Pupil app, based on the shipped code and the Phase 1 / Phase 2 specs.

## Recently closed

- AI generation is now wired end-to-end through the Tauri backend. The renderer calls a real `generate_cards` command, the Rust side makes the provider HTTP request, and the review/save flow still happens in the app UI. See [`AiGenerateScreen.tsx`](../apps/app/src/components/ai-generate/AiGenerateScreen.tsx), [`ai-settings.ts`](../apps/app/src/lib/ai-settings.ts), and [`lib.rs`](../apps/app/src-tauri/src/lib.rs).
- AI settings now persist as specified: non-secret fields live in SQLite `settings`, the API key is stored in Stronghold, and the `Test` action performs a live provider request. See [`SettingsScreen.tsx`](../apps/app/src/components/settings/SettingsScreen.tsx) and [`lib.rs`](../apps/app/src-tauri/src/lib.rs).
- Settings data actions are now real: database export, review-log CSV export, and full local reset are wired to backend commands, and the stale "0 reviews" placeholder copy is gone. See [`SettingsScreen.tsx`](../apps/app/src/components/settings/SettingsScreen.tsx), [`data-actions.ts`](../apps/app/src/lib/data-actions.ts), and [`lib.rs`](../apps/app/src-tauri/src/lib.rs).
- Dashboard activity is now sourced from `review_logs`, and the inert "View all →" affordance was removed. See [`App.tsx`](../apps/app/src/App.tsx), [`activity.ts`](../apps/app/src/lib/activity.ts), and [`ActivitySection.tsx`](../apps/app/src/components/dashboard/ActivitySection.tsx).

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

1. Add rename/delete space actions to the visible UI.
2. Replace placeholder external links and other inert surfaced controls.
3. Add a minimal automated test layer around imports, study scheduling, stats queries, and the new AI/settings flows.
4. Revisit import limitations if media, history transfer, or import history persistence become important.
