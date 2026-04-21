# Releasing Pupil Desktop

Desktop releases are versioned from `apps/app/package.json`. That file is the canonical source of truth for the desktop app version. `apps/app/src-tauri/Cargo.toml` must match it, and `apps/app/src-tauri/tauri.conf.json` must keep `"version": "../package.json"`.

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

- Use semver prerelease versions like `1.0.0-alpha.1`, `1.0.0-beta.1`, or `1.0.0-rc.1`. Do not use plain `1.0.0` for prereleases.
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
