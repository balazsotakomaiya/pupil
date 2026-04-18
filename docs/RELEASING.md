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

2. Review the changed files, open a version bump PR, and merge it to `main`.

3. Create an annotated tag from `main` using the exact desktop release format:

   ```bash
   git tag -a app-v0.0.2 -m "Pupil v0.0.2"
   git push origin app-v0.0.2
   ```

4. GitHub Actions runs `.github/workflows/publish.yml` on the tag and publishes desktop assets to GitHub Releases.

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

- Releases are stable-only in v1. There is no prerelease channel yet.
- Desktop installers are intentionally unsigned in this first phase.
- macOS users should expect Gatekeeper friction until notarization is added.
- Windows users should expect SmartScreen friction until code signing is added.
