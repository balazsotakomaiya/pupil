# Changelog

All notable changes to the Pupil desktop app are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Desktop releases are tagged `app-v<version>`; see [`docs/RELEASING.md`](./docs/RELEASING.md).

## [Unreleased]

### Added

- Content Security Policy for the webview, forbidding inline and remote scripts.
- Renderer warnings and errors are now mirrored into the backend's rotating log file, so a bug report from a release build has diagnostics attached.
- Timeouts on AI provider requests, and a total wall-clock budget for the explanation retry loop.
- `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, this changelog, and GitHub issue and pull request templates.
- Unit coverage for the card text escaping and formatting path.

### Changed

- The native window frame now follows the in-app light/dark theme instead of being pinned to dark.
- AI provider requests share one pooled HTTP client rather than building a new one per call.
- Card text escaping and formatting moved into a single shared module (`src/lib/card-markup.ts`); the study view and the card editor preview no longer carry separate copies.

### Removed

- The MCP bridge development plugin is no longer compiled into release builds, and its capability grant is no longer present in the shipped capability set. It is now behind an opt-in cargo feature that only `dev` enables.

### Fixed

- Corrected "Asses" to "Assess" in marketing site copy.

## Prior releases

Pupil has been published as a `1.0.0` alpha series. Release notes and downloadable assets for each are on the [releases page](https://github.com/balazsotakomaiya/pupil/releases). Broad strokes:

- **1.0.0-alpha.9** — light mode, onboarding fixes, and the first real test layer (Vitest for the frontend, `cargo test` for the backend, both wired into CI).
- **1.0.0-alpha.8** — AI card explanations with generated visual charts, and a migration path for database updates.
- **1.0.0-alpha.7** — Stronghold vault encrypted with a random key held in the OS keystore, centralized modals, delete confirmations, and a rebuilt marketing site with platform-specific download links.
- **1.0.0-alpha.1 – alpha.6** — the initial public alpha line: spaces, manual card authoring, Anki `.apkg` import, AI generation with a review gate, FSRS-5 scheduling, dashboard and per-space stats, tray integration, and data export.

[Unreleased]: https://github.com/balazsotakomaiya/pupil/compare/app-v1.0.0-alpha.9...HEAD
