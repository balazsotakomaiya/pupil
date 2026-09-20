# Changelog

All notable changes to the Pupil desktop app are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Desktop releases are tagged `app-v<version>`; see [`docs/RELEASING.md`](./docs/RELEASING.md).

## [Unreleased]

## [1.0.0-alpha.11] - 2026-09-20

### Added

- View a cached AI explanation from the cards list (expanded card → explanation panel), without starting a study session.
- Escalating status copy while an explanation is still loading, so long waits feel intentional rather than stuck.

### Changed

- Study explanation prompts steer harder toward learner-facing prose and only emit a diagram when the concept is inherently structural (not a glossary / definition decoration).
- Persisted glossary-style visuals are dropped when loading a cached explanation, so older decorative diagrams no longer resurface.
- Card summaries expose whether an explanation is already cached (`has_explanation`).
- Marketing site: Open Graph / Twitter social card (`og.jpg`) with the dither gradient treatment; README header banner asset.

### Fixed

- React Flow connection handle dots no longer show on explanation diagrams.

## [1.0.0-alpha.10] - 2026-09-19

### Added

- Light mode, with the native window frame following the in-app light/dark theme.
- Content Security Policy for the webview, forbidding inline and remote scripts.
- Renderer warnings and errors are now mirrored into the backend's rotating log file, so a bug report from a release build has diagnostics attached.
- Timeouts on AI provider requests, and a total wall-clock budget for the explanation retry loop.
- In-app desktop update checks and install UI (OTA) for builds that can reach the updater channel.
- Shared `@pupil/core` domain package and a `PupilStorage` persistence seam used by both the desktop and browser surfaces.
- Shared Button primitive and design tokens for hover, overlay, and semantic colors.
- New Card action in the app header; settings layout refinements and provider model discovery.
- `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, this changelog, and GitHub issue and pull request templates.
- Frontend (Vitest) and Rust (`cargo test`) coverage groundwork, including contract tests for storage.

### Changed

- AI provider requests share one pooled HTTP client rather than building a new one per call.
- Card text escaping and formatting moved into a single shared module (`src/lib/card-markup.ts`); the study view and the card editor preview no longer carry separate copies.
- Marketing site: hero dither backdrop, earlier download CTA, manifesto nav hidden pending rewrite (redirects `/manifesto`).

### Removed

- The MCP bridge development plugin is no longer compiled into release builds, and its capability grant is no longer present in the shipped capability set. It is now behind an opt-in cargo feature that only `dev` enables.
- Unused persisted-data Zustand store.

### Fixed

- Onboarding flow corrections.
- Browser Anki import now writes full cards; web AI controls replaced with a desktop download notice.
- Corrected "Asses" to "Assess" in marketing site copy.

## Prior releases

Pupil has been published as a `1.0.0` alpha series. Release notes and downloadable assets for each are on the [releases page](https://github.com/balazsotakomaiya/pupil/releases). Broad strokes:

- **1.0.0-alpha.11** — explanation UX polish (cards-list viewer, fewer decorative diagrams, slow-load status), plus site OG/README banner assets.
- **1.0.0-alpha.10** — light mode, `@pupil/core` / `PupilStorage`, design tokens, in-app OTA update UI, and the hardening/docs/test work accumulated since alpha.9.
- **1.0.0-alpha.9** — early public alpha cut on the July line (see GitHub release assets).
- **1.0.0-alpha.8** — AI card explanations with generated visual charts, and a migration path for database updates.
- **1.0.0-alpha.7** — Stronghold vault encrypted with a random key held in the OS keystore, centralized modals, delete confirmations, and a rebuilt marketing site with platform-specific download links.
- **1.0.0-alpha.1 – alpha.6** — the initial public alpha line: spaces, manual card authoring, Anki `.apkg` import, AI generation with a review gate, FSRS-5 scheduling, dashboard and per-space stats, tray integration, and data export.

[Unreleased]: https://github.com/balazsotakomaiya/pupil/compare/app-v1.0.0-alpha.11...HEAD
[1.0.0-alpha.11]: https://github.com/balazsotakomaiya/pupil/compare/app-v1.0.0-alpha.10...app-v1.0.0-alpha.11
[1.0.0-alpha.10]: https://github.com/balazsotakomaiya/pupil/compare/app-v1.0.0-alpha.9...app-v1.0.0-alpha.10
