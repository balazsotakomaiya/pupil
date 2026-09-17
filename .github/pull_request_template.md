## What this changes

<!-- What does this do, and why? Link any issue it closes. -->

## User-visible behaviour

<!-- What will someone using Pupil notice? Write "none" for internal-only changes. -->

## How it was tested

<!-- What you actually ran, and on which platforms. Pupil ships on macOS, Windows,
     and Linux, and a fair amount of this code is platform-conditional. -->

- [ ] `bun run lint`
- [ ] `bun run typecheck`
- [ ] `bun run test`
- [ ] `bun run lint:rust`
- [ ] `bun run format:check`

Ran the app on: <!-- macOS / Windows / Linux / not run -->

## Checklist

- [ ] Query invalidation updated, if this mutation changes cards, spaces, dashboard stats, or study settings
- [ ] New migrations are append-only and registered in the `MIGRATIONS` registry
- [ ] No AI secrets written to SQLite
- [ ] Component styles live in collocated `*.module.css` files
- [ ] `CHANGELOG.md` updated under Unreleased, if this is user-visible
