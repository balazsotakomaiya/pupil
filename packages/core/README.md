# @pupil/core

Platform-agnostic domain layer shared by every Pupil surface.

This package holds the parts of Pupil that do not care where data is stored or
which shell is rendering: domain types, FSRS scheduling, study-queue rules,
shared validation, and the `PupilStorage` interface that every storage backend
implements.

## Why it exists

Pupil is heading for more than one surface — the Tauri desktop app today, plus a
browser PWA, a mobile shell, and cloud sync later. Those surfaces differ only in
**where data lives** and **what the shell can do**. Everything else — how a card
is scheduled, which cards are due, what counts as a streak — must behave
identically everywhere, so it lives here and is depended on rather than
reimplemented.

## What belongs here

- Domain types (`CardRecord`, `SpaceSummary`, `DashboardStats`, …)
- FSRS scheduling (`scheduleCard`, `previewCardScheduling`)
- Study-queue rules (`buildDueQueue`, `buildStudyQueueSnapshot`, …)
- Shared validation (`normalizeCardInput`, `normalizeSpaceName`, …)
- Calendar-day and streak helpers (`formatDayKey`, `computeStreak`)
- The `PupilStorage` interface

## What does not belong here

- Anything touching `window`, `localStorage`, `document`, or the DOM
- Tauri IPC, React, or any UI concern
- Network calls, secret storage, or platform APIs
- Product copy and view-model shaping (that stays in the consuming app)

This boundary is **enforced by the compiler**, not by convention:
`tsconfig.json` sets `"lib": ["ES2022"]` and `"types": []`, so referencing
`window` or any Node/DOM global fails `typecheck`.

## Consuming it

The package is consumed as a workspace dependency and exposes a single
entrypoint. Import from the package root — deep imports into `src/` are not part
of the contract and will break when the internal layout changes:

```ts
import { scheduleCard, type CardRecord, type PupilStorage } from "@pupil/core";
```

## The storage seam

`PupilStorage` is the interface each surface implements:

| Surface | Implementation | Status |
| --- | --- | --- |
| Desktop | Tauri commands over SQLite | `apps/app/src/lib/storage/tauri.ts` |
| Browser fallback | `localStorage` | `apps/app/src/lib/storage/web.ts` |
| Browser PWA | IndexedDB / SQLite-wasm | planned |
| Mobile | Native SQLite | planned |
| Sync | Remote adapter over a local store | planned |

Implementations own **persistence**. `reviewCard` resolves the next FSRS state
with this package's scheduler before storing it, so scheduling has exactly one
definition regardless of which backend is active.

Because the app selects an implementation in one place and every call site goes
through it, adding a surface is a new implementation of this interface — not a
change to calling code.

## Commands

```bash
bun run --cwd packages/core test
bun run --cwd packages/core typecheck
bun run --cwd packages/core lint
```

## Licensing

MIT, like the rest of the public repo. Closed-source surfaces are expected to
consume this package rather than fork it — see
[`docs/MULTI_PLATFORM_ARCHITECTURE.md`](../../docs/MULTI_PLATFORM_ARCHITECTURE.md).
