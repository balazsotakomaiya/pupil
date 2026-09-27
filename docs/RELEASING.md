# Releasing Pupil Desktop

Desktop releases are versioned from `apps/app/package.json`. That file is the canonical source of truth for the desktop app version. `apps/app/src-tauri/Cargo.toml` must match it, `apps/app/src-tauri/tauri.conf.json` must keep `"version": "../package.json"`, and `apps/app/src-tauri/tauri.windows.conf.json` must keep the derived MSI-safe WiX version in sync.

## One-time setup

### Updater signing

Before you tag the first release, configure these GitHub Actions secrets in the repository:

- `TAURI_SIGNING_PRIVATE_KEY` — the full contents of the updater private key.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password for that updater key.

The updater public key is committed in `apps/app/src-tauri/tauri.conf.json`. The matching private key is intentionally not tracked in git.

Updater signing is separate from Apple notarization or Windows code signing. Losing the updater private key or its password will prevent future updates from being trusted by already-installed copies of the app.

### macOS signing and notarization

Unsigned `.dmg` downloads hit Gatekeeper ("cannot be opened because the developer cannot be verified"). Signing and notarization are what remove that. This is independent of updater signing above.

PR and CI builds stay unsigned (`--no-sign`). Only the `Publish` workflow signs, and only when the Apple secrets below are present. Until they are, macOS artifacts keep shipping unsigned.

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. In [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/certificates/list), create a **Developer ID Application** certificate. Only the Account Holder can create this type. It is the certificate for apps shipped outside the App Store; do not use Apple Distribution.
3. Install the `.cer` on a Mac, then in Keychain Access export the private key as a `.p12` with a password.
4. Base64-encode the `.p12`:

   ```bash
   openssl base64 -A -in certificate.p12
   ```

5. Add these GitHub Actions secrets:

   | Secret | Value |
   | --- | --- |
   | `APPLE_CERTIFICATE` | Output of the `openssl` command above |
   | `APPLE_CERTIFICATE_PASSWORD` | Password used when exporting the `.p12` |
   | `APPLE_SIGNING_IDENTITY` | Optional. Common Name from `security find-identity -v -p codesigning`, usually `Developer ID Application: Name (TEAMID)` |

6. Add notarization credentials. Prefer an [App Store Connect API key](https://appstoreconnect.apple.com/access/integrations/api) with Developer access:

   | Secret | Value |
   | --- | --- |
   | `APPLE_API_KEY` | Key ID |
   | `APPLE_API_ISSUER` | Issuer ID shown above the keys table |
   | `APPLE_API_KEY_CONTENT` | Full contents of the downloaded `.p8` file |

   Fallback if you would rather use an Apple ID: `APPLE_ID` (account email), `APPLE_PASSWORD` (an [app-specific password](https://support.apple.com/en-us/102654), not the account password), `APPLE_TEAM_ID` (from the [membership page](https://developer.apple.com/account)).

After the next `app-v*` publish, download both macOS `.dmg` files on a Mac that has never opened Pupil and confirm the app launches without a Gatekeeper warning. `SECURITY.md` should be updated only after that check passes.

### Windows code signing

Windows installers stay unsigned. Microsoft's Artifact Signing Public Trust path is limited to individuals in the US and Canada; an EU individual would need a company, a paid Authenticode cert, or the Store. Pupil will not form a legal entity for this. The Store MSIX route (Microsoft signs the package) is off the table because Tauri does not generate MSIX.

SmartScreen "Unknown publisher" on first install is expected; the workaround is More info → Run anyway.

Longer-term, [SignPath Foundation](https://signpath.org/apply) may sign qualifying OSS without a company. That is tracked in [#40](https://github.com/balazsotakomaiya/pupil/issues/40), not a 1.0 blocker.

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
   - if Apple signing secrets are configured, both macOS `.dmg` files open on a clean Mac without a Gatekeeper warning
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
- macOS `.dmg` files are signed and notarized on tagged publishes once the Apple secrets in *One-time setup* are set. Until then they ship unsigned, and Gatekeeper friction is expected.
- Windows installers stay unsigned. Microsoft's signing service is not available to EU individuals, and we will not form a company for this. SmartScreen friction is expected. SignPath is a possible later option ([#40](https://github.com/balazsotakomaiya/pupil/issues/40)).
