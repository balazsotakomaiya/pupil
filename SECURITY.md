# Security Policy

## Reporting a vulnerability

Please do not report security issues in public GitHub issues.

Use GitHub's private reporting instead: go to the [Security tab](https://github.com/balazsotakomaiya/pupil/security/advisories/new) and open a draft advisory. That reaches the maintainers privately and gives us a place to coordinate a fix and a release.

Please include:

- what the issue is and roughly how severe you think it is,
- steps to reproduce, ideally with a minimal example,
- the Pupil version (Settings → About) and your operating system,
- whether it needs an AI provider configured, an imported deck, or any other particular setup.

You will get an acknowledgement within a week. Please give us a chance to ship a fix before disclosing publicly.

## Supported versions

Pupil is pre-1.0 and is currently published as alpha builds. Only the most recent release gets security fixes. Once 1.0 ships, this section will name the supported release line.

## What Pupil handles

Understanding the threat model helps to judge what is worth reporting.

- **Your study data is local.** Cards, spaces, review history, and settings live in a SQLite database in the app data directory. There is no account, no server, and no sync.
- **The AI API key is the one real secret.** It is never written to SQLite. On macOS it lives in the system Keychain; on Windows and Linux it lives in a Stronghold vault encrypted with a random key held in the OS secure store. Anything that exposes this key is in scope.
- **Card content is untrusted input.** Card text can come from an AI provider or an imported Anki deck, and it is rendered as HTML so that basic formatting works. It is escaped first, in a single shared routine (`apps/app/src/lib/card-markup.ts`), and the webview runs under a content security policy that forbids inline and remote scripts. An escape bypass, or a way to get script execution in the webview, is very much in scope.
- **Outbound network requests** go to the AI provider base URL you configure, and to Google Fonts for the app's typefaces. Nothing else phones home.

### Known and accepted

These are documented tradeoffs rather than vulnerabilities. Reporting them is not necessary.

- **Installers are unsigned.** macOS Gatekeeper and Windows SmartScreen will warn on install. Code signing and notarization are not yet in place.
- **The base URL is user-controlled by design.** Pupil talks to whatever OpenAI-compatible endpoint you point it at, including a local one. That means it can be pointed at an internal address; this is the intended feature.
- **The MCP bridge development plugin** grants arbitrary JS and command execution, and is deliberately excluded from release builds. If you ever find it reachable in a distributed build, that *is* a vulnerability worth reporting.
