# App Gaps

Snapshot of the meaningful gaps still remaining in the current Pupil app, based on the shipped code and the Phase 1 / Phase 2 specs.

## Recently closed

- AI generation is now wired end-to-end through the Tauri backend. The renderer calls a real `generate_cards` command, the Rust side makes the provider HTTP request, and the review/save flow still happens in the app UI. See [`AiGenerateScreen.tsx`](../apps/app/src/components/ai-generate/AiGenerateScreen.tsx), [`ai-settings.ts`](../apps/app/src/lib/ai-settings.ts), and [`lib.rs`](../apps/app/src-tauri/src/lib.rs).
- AI settings now persist as specified: non-secret fields live in SQLite `settings`, the API key is stored in Stronghold, and the `Test` action performs a live provider request. See [`SettingsScreen.tsx`](../apps/app/src/components/settings/SettingsScreen.tsx) and [`lib.rs`](../apps/app/src-tauri/src/lib.rs).
- Settings data actions are now real: database export, review-log CSV export, and full local reset are wired to backend commands, and the stale "0 reviews" placeholder copy is gone. See [`SettingsScreen.tsx`](../apps/app/src/components/settings/SettingsScreen.tsx), [`data-actions.ts`](../apps/app/src/lib/data-actions.ts), and [`lib.rs`](../apps/app/src-tauri/src/lib.rs).
- Dashboard activity is now sourced from `review_logs`, and the inert "View all →" affordance was removed. See [`activity.ts`](../apps/app/src/lib/activity.ts) and [`ActivitySection.tsx`](../apps/app/src/components/dashboard/ActivitySection.tsx).
- App navigation now runs through TanStack Router with in-memory routes, and app data fetching is moving through TanStack Query instead of `App.tsx`-level orchestration.
- Frontend error boundaries, notifications, and structured backend `AppError` payloads are now in place.

## 3. Space CRUD is only partially exposed in the UI

- The backend supports `rename_space` and `delete_space`. See [`lib.rs`](../apps/app/src-tauri/src/lib.rs).
- The frontend data layer also exposes rename/delete operations. See [`spaces.ts`](../apps/app/src/lib/spaces.ts).
- But the current UI only gives users a create-space flow. There is no visible rename/delete path in the dashboard or space detail screens.
- Result: the codebase has full space CRUD underneath, but the product surface does not.

## 4. Import still has Phase 1 limitations

- `.apkg` media import is still skipped. Images/audio are not brought in.
- Anki review history is not transferred; imported cards start fresh under Pupil's FSRS state.
- Import history is renderer-managed instead of being persisted as first-class app data. See [`ImportScreen.tsx`](../apps/app/src/components/import/ImportScreen.tsx) and [`imports.ts`](../apps/app/src/lib/imports.ts).
- These are acceptable short-term tradeoffs, but they remain functional gaps relative to a fuller migration story.

## 5. Some surfaced controls are still inert or placeholder-grade

- The titlebar search button is visible, but there is no actual search flow wired from it.
- The settings "Docs", "GitHub", and "Issues" links are placeholder URLs pointing to generic GitHub locations, not Pupil-specific destinations. See `handleOpenExternal()` in [`SettingsScreen.tsx`](../apps/app/src/components/settings/SettingsScreen.tsx).

## Recommended next order

1. Add rename/delete space actions to the visible UI.
2. Replace placeholder external links and other inert surfaced controls.
3. Expand automated coverage around imports, study scheduling, stats queries, and the AI/settings flows.
4. Revisit import limitations if media, history transfer, or import history persistence become important.
