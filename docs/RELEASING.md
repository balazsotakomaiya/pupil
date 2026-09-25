# Releasing Pupil Desktop

Desktop releases are versioned from `apps/app/package.json`. That file is the canonical source of truth for the desktop app version. `apps/app/src-tauri/Cargo.toml` must match it, `apps/app/src-tauri/tauri.conf.json` must keep `"version": "../package.json"`, and `apps/app/src-tauri/tauri.windows.conf.json` must keep the derived MSI-safe WiX version in sync.

## One-time setup

Before you tag the first release, configure these GitHub Actions secrets in the repository:

- `TAURI_SIGNING_PRIVATE_KEY` — the full contents of the updater private key.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password for that updater key.

The updater public key is committed in `apps/app/src-tauri/tauri.conf.json`. The matching private key is intentionally not tracked in git.

Updater signing is separate from Apple notarization or Windows code signing. Losing the updater private key or its password will prevent future updates from being trusted by already-installed copies of the app.

## Release flow

1. Update the desktop version:

   ```bash
   bun run release:version 0.0.2
   ```

   For prereleases, use a semver prerelease suffix:

   ```bash
   bun run release:version 1.0.0-alpha.1
   ```

   The release script also updates the Windows-only WiX version override that MSI packaging requires.

2. Review the changed files, open a version bump PR, and merge it to `main`.

   Before merging, run:

   ```bash
   bun run lint
   bun run typecheck
   bun run test
   bun run lint:rust
   bun run format:check
   ```

3. Create an annotated tag from `main` using the exact desktop release format:

   ```bash
   git tag -a app-v0.0.2 -m "Pupil v0.0.2"
   git push origin app-v0.0.2
   ```

   Prereleases use the same tag format with the semver suffix:

   ```bash
   git tag -a app-v1.0.0-alpha.1 -m "Pupil v1.0.0-alpha.1"
   git push origin app-v1.0.0-alpha.1
   ```

4. GitHub Actions runs `.github/workflows/publish.yml` on the tag and publishes desktop assets to GitHub Releases.
   Stable versions publish as normal releases.
   Versions with a semver prerelease suffix, such as `-alpha.1`, publish as GitHub prereleases.

5. Verify the finished release:
   - the release title is `Pupil v0.0.2`
   - assets exist for Linux x86_64, Windows x86_64, macOS Intel, and macOS Apple Silicon
   - updater signatures are present
   - `latest.json` is available at:

     `https://github.com/balazsotakomaiya/pupil/releases/latest/download/latest.json`

## Validation commands

- `bun run release:check`
- `bun run release:check --tag app-v0.0.2`

The publish workflow fails fast if the pushed tag does not equal `app-v${apps/app/package.json version}`.

## Prerelease notes

- Use semver prerelease versions like `1.0.0-alpha.1`, `1.0.0-beta.1`, or `1.0.0-rc.1`. Numeric prereleases like `1.0.0-7` also work. Do not use plain `1.0.0` for prereleases.
- Windows MSI builds cannot use text prerelease identifiers directly, so the release script derives `bundle.windows.wix.version` in `apps/app/src-tauri/tauri.windows.conf.json`. For example, `1.0.0-alpha.1` maps to `1.0.0.10001`.
- The release contract currently supports prerelease channels `alpha`, `beta`, and `rc` for Windows MSI packaging.
- The publish workflow automatically marks any `app-v<version-with-hyphen>` tag as a GitHub prerelease.
- The app updater still points at `https://github.com/balazsotakomaiya/pupil/releases/latest/download/latest.json`.
- GitHub's "latest release" endpoint excludes prereleases, so alpha builds will not join the stable auto-update channel until Pupil gets a dedicated prerelease updater endpoint.

## Recovering a failed publish

If a publish failed and you need to retry it after pushing fixes, use the manual `Publish` workflow in GitHub Actions:

1. Push the fix commit to the branch you want to publish from, usually `main`.
2. Open `Actions` → `Publish` → `Run workflow`.
3. Enter:
   - `tag`: the existing release tag, for example `app-v0.0.2`
   - `ref`: the branch, tag, or commit SHA to build from, for example `main`
4. Run the workflow. It will clear the existing assets for that release tag, rebuild from the selected ref, and upload a fresh set of assets.

This recovery path is meant for “the release failed, fix it and republish” situations. It can produce release assets from a newer commit than the git tag originally pointed at. If you want the source tag and shipped binaries to match exactly, move the tag yourself or cut a new version instead.

## Current release behavior

- GitHub Releases support both stable releases and semver prereleases.
- The built-in app updater still follows the stable release channel only.
- Desktop installers are intentionally unsigned in this first phase.
- macOS users should expect Gatekeeper friction until notarization is added.
- Windows users should expect SmartScreen friction until code signing is added.

## Release film

A 20-second announcement film lives at [`apps/site/release-film.html`](../apps/site/release-film.html). It is one deterministic timeline: every frame is a pure function of time, so the page plays live in a browser (`bun run --cwd apps/site dev`, then open `/release-film.html`; Space pauses, arrow keys step frames, `?format=portrait` previews the tall cut) and renders frame-perfect to video.

The renderer needs Playwright with Chromium and an ffmpeg build with libx264 on `PATH` (or `FFMPEG=/path/to/ffmpeg`). The version on screen comes from `apps/app/package.json` without its prerelease suffix (`1.0.0-alpha.10` shows as `v1.0.0`, since the film announces the stable line), so re-render after `release:version`. Films end on the logo lockup, which is what LinkedIn and YouTube show once playback stops; add `--loop` for a fade-to-black cut that loops seamlessly.

| Asset | Command |
| --- | --- |
| 16:9 1080p60, for YouTube (Product Hunt only takes YouTube links) and the GitHub release | `bun run release:film` → `docs/assets/release-film.mp4` |
| 4:5 1080×1350 at 30fps, for the LinkedIn feed | `node scripts/render-release-film.mjs --format portrait --fps 30 --crf 20 --out linkedin.mp4` |
| 240×240 looping GIF, for the Product Hunt thumbnail (limit 3MB) | `node scripts/render-release-film.mjs --format thumb --width 240 --out thumbnail.gif` |
| Stills for covers and gallery images (Product Hunt gallery is 1270×760) | `node scripts/render-release-film.mjs --no-hud --stills 4.5,8.1,11.6,18.3` |

Videos carry a silent AAC track because some upload pipelines expect one. `--cut ai` renders the experimental cut, which gives AI generation its own scene ("Write your own cards. / Or let AI draft them.", then topic → drafts → approved cards → the study deck) and puts "Opens in a blink" in its place among the feature words; preview it at `/release-film.html#ai`.
