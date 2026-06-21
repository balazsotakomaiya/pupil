# Multi-Platform Architecture: Browser, Mobile, and Cloud Sync

This document maps out how Pupil could grow from a single open-source desktop
app into three surfaces — **a browser app**, **a closed-source mobile app**, and
**a paid cloud sync service** — without rewriting the product. It is a design
map, not an implementation plan: it identifies the seams that already exist, the
ones that need to be built, and the order that keeps risk low.

## TL;DR

- The app already has the most important seam: every data-access function in
  `apps/app/src/lib` branches on `isTauriRuntime()` between a **Tauri/SQLite
  backend** and a **localStorage web fallback**. Browser, mobile, and sync are
  all new branches behind that same seam.
- FSRS scheduling already lives in shared, platform-agnostic TypeScript
  (`apps/app/src/lib/fsrs.ts`). It can run unchanged on desktop, browser, and
  mobile. This is the single most valuable thing about the current design.
- The cleanest path is to **extract a shared core** (domain types, FSRS, a
  `Storage` interface) into a workspace package, keep it MIT, and build the
  closed-source mobile app and paid sync backend as *separate consumers* of that
  core.
- Local-first stays the default. Cloud sync is an **opt-in, paid add-on** layered
  on top — never a requirement to use the app.

---

## 1. Where we are today

### The data-access seam

The whole strategy hinges on a pattern that is already in the codebase. Every
data operation in `apps/app/src/lib/*.ts` looks like this (`cards.ts:61`):

```ts
export async function listCards(input = {}): Promise<CardRecord[]> {
  if (isTauriRuntime()) {
    return invokeCommand<CardRecord[]>("list_cards", { spaceId: input.spaceId ?? null });
  }
  // browser fallback: read from localStorage
  return readWebCards().filter(...);
}
```

There are effectively two storage backends behind one interface:

| Backend | Runtime | Persistence | Where |
| --- | --- | --- | --- |
| Tauri/Rust/SQLite | Desktop (`__TAURI_INTERNALS__` present) | SQLite, canonical | `src-tauri/src/*.rs` |
| Web fallback | Any browser | `localStorage` | inline in `src/lib/*.ts` |

`isTauriRuntime()` (`runtime.ts:7`) is the switch. `invokeCommand()`
(`ipc.ts:6`) is the desktop transport. The browser fallback is hand-written
localStorage CRUD inside each lib file.

### What is already portable

- **FSRS scheduling** is computed in TypeScript and merely *persisted* by Rust
  (`AGENTS.md` invariant: "FSRS scheduling stays in TypeScript. Rust persists
  validated results"). The scheduling brain is platform-neutral.
- **The data model is small and clean**: `spaces`, `cards`, `review_logs`,
  `study_days`, `settings` (`migrations/0001_init.sql`). Every row already has
  a string `id` (UUID) and `created_at` / `updated_at`. That is most of what a
  sync engine needs.
- **AI generation** is an HTTP call to an OpenAI-/Anthropic-compatible provider,
  today proxied through Rust (`ai.rs`) with the key in Tauri Stronghold.

### What blocks the next step

1. **The web fallback is a toy.** It is per-file, untyped-at-rest localStorage
   with no shared abstraction, no quota handling, no real query engine. It
   proves the seam works; it is not a shippable browser backend.
2. **Storage logic is duplicated**, once in Rust SQL and once in TS localStorage.
   Adding a third backend (remote API) by copy-paste would triple the
   maintenance surface.
3. **No sync primitives.** The schema has `updated_at` but no change tokens,
   no soft-delete tombstones, no per-device identity, no conflict resolution.
4. **No shared package boundary.** `package.json` declares `workspaces:
   ["apps/*"]` but `AGENTS.md` notes "There is no meaningful shared package
   layer yet." Closed-source reuse needs that boundary to be explicit.
5. **Secrets are desktop-shaped.** The AI key lives in Stronghold / macOS
   Keychain (`constants.rs`). Browser and mobile need different secret stores.

---

## 2. Target shape

```
                 ┌─────────────────────────────────────────────┐
                 │  @pupil/core  (MIT, shared package)          │
                 │  • domain types (Card, Space, ReviewLog…)    │
                 │  • FSRS scheduling (fsrs.ts)                  │
                 │  • study queue / derived stats               │
                 │  • Storage interface  (the seam, formalized) │
                 └───────────────┬─────────────────────────────┘
                                 │ implemented by ↓
   ┌──────────────┬──────────────┼──────────────┬───────────────────┐
   │              │              │              │                   │
┌──┴────┐   ┌─────┴─────┐  ┌─────┴──────┐  ┌────┴─────┐      ┌───────┴────────┐
│Tauri  │   │ Browser   │  │  Mobile    │  │  Remote  │      │  Sync backend  │
│SQLite │   │ IndexedDB │  │ SQLite     │  │  API     │ ───▶ │  (paid, SaaS)  │
│(OSS)  │   │ (OSS PWA) │  │(closed src)│  │ adapter  │      │  Postgres +    │
└───────┘   └───────────┘  └────────────┘  └──────────┘      │  auth + billing│
                                                              └────────────────┘
```

The product is the same React UI everywhere. What changes per surface is **which
`Storage` implementation is injected** and **whether a sync adapter is layered on
top of local storage**.

---

## 3. Browser version (OSS, ships first)

The browser app is the lowest-risk surface because the seam already supports it.

**Goal:** a real, installable PWA at the existing domain (there is already a
`CNAME` and an `apps/site` marketing site) that runs the full study loop offline.

**Changes:**

1. **Formalize the seam into a `Storage` interface.** Replace the per-function
   `if (isTauriRuntime())` branches with a single injected `storage` object that
   has `listCards`, `createCard`, `reviewCard`, etc. The Tauri path becomes
   `TauriStorage`; today's localStorage path becomes `WebStorage`.
2. **Upgrade web persistence from localStorage to IndexedDB** (via a thin wrapper
   or `sqlite-wasm` / OPFS for a true SQLite-in-the-browser story). localStorage
   will not survive a real card collection; it is synchronous and ~5 MB capped.
   `sql.js` / `wa-sqlite` lets the browser reuse the *same schema and SQL* as the
   desktop, killing the duplication problem.
3. **Build target.** Add a Vite `build` mode that excludes `@tauri-apps/*` and
   ships a static bundle + service worker + web manifest. The UI is already React
   + Vite, so this is configuration, not rewrite.
4. **AI keys in the browser.** Either (a) BYO-key stored in IndexedDB with a
   clear "this stays in your browser" disclosure, or (b) route AI through the
   sync backend so the key never touches the client (preferred once sync exists).

**What you get:** zero-install trial, shareable links, the SEO/marketing funnel,
and the exact substrate the mobile webview and sync clients will reuse.

**Licensing:** stays MIT. The browser app is part of the OSS story.

---

## 4. Mobile app (closed source)

The constraint "mobile will not be OSS" drives the package boundary. You cannot
cleanly close-source one app inside an MIT monorepo without first deciding *what
is shared and stays open* vs. *what is proprietary*.

### 4.1 Licensing strategy (do this first)

- **Keep `@pupil/core` MIT.** Domain types, FSRS, study-queue logic, the
  `Storage` interface. This is the part already in the public repo; trying to
  re-close it is pointless and brittle.
- **The mobile app lives in a separate private repo** that depends on
  `@pupil/core` as a versioned package (private npm registry, or git submodule).
  The proprietary parts — native shell, push notifications, in-app purchase,
  premium-only screens — never enter the public tree.
- This is the standard "open core" split: MIT engine, commercial distribution.
  Because the current license is permissive MIT (`LICENSE`), you are free to
  build closed-source products on top. Confirm no future dependency flips to a
  copyleft (GPL) license, which would contaminate the closed shell.

### 4.2 Technology choice

| Approach | Reuse | Native feel | Effort | Notes |
| --- | --- | --- | --- | --- |
| **Capacitor / Tauri Mobile** wrapping the existing React app | Highest (≈ whole UI) | Good | Low | Tauri v2 already targets iOS/Android; the team knows Tauri. Strong default. |
| **React Native** (reuse logic, rebuild UI) | Core logic only | Best | High | Rebuild every screen; only `@pupil/core` carries over. |
| **PWA "add to home screen"** | Total | Weakest | ~0 | Free byproduct of §3; no app-store presence, limited push/IAP. |

**Recommendation:** **Tauri Mobile (v2)** or **Capacitor** wrapping the React UI.
The app is already a React/Vite frontend over a Tauri shell — mobile Tauri reuses
that almost wholesale, and the `Storage` interface lets the mobile shell provide
a native SQLite implementation (same schema as desktop). The PWA from §3 is the
fallback/preview track, not the shippable store app.

### 4.3 Mobile-specific concerns

- **Storage:** native SQLite (mirror the desktop schema) behind a `MobileStorage`
  implementation of the `Storage` interface.
- **Secrets:** iOS Keychain / Android Keystore instead of Stronghold.
- **Notifications:** the desktop tray/reminder concept (`tray.rs`,
  `notifications.ts`) maps to native local notifications for due-card nudges —
  this is a natural premium hook on mobile.
- **App-store compliance:** if cloud sync is sold, Apple/Google will require
  their in-app-purchase rails (≈ 15–30% cut) for digital subscriptions bought
  inside the app. Plan billing around this (see §5.4).

---

## 5. Cloud sync (paid)

Sync is the monetizable surface and the only piece that requires server
infrastructure. It is layered **on top of** local-first storage, never replacing
it: the app must remain fully functional offline and for users who never pay.

### 5.1 Model: local-first + sync, not server-of-record

Each device keeps its local store (SQLite / IndexedDB) as the working copy. A
**sync adapter** reconciles local changes with a server. This preserves the
"everything stays on your machine" promise for free users and makes sync an
enhancement rather than a dependency.

### 5.2 Schema changes required for sync

The current schema (`migrations/0001_init.sql`) needs sync metadata. All
additions are append-only migrations (`MIGRATIONS` in `constants.rs`):

1. **Tombstones / soft delete.** Add `deleted_at INTEGER` to `cards`, `spaces`,
   etc. Hard deletes cannot sync — a removed row is indistinguishable from a row
   the other device hasn't seen yet.
2. **Change tracking.** A monotonic `updated_at` exists, but add a per-row
   `rev`/version and a per-device **change log** (or rely on `updated_at` +
   last-pulled cursor) so the client can ask "what changed since cursor X".
3. **Identity.** A `user_id` / account association and a `device_id` for
   origin tracking and conflict attribution.
4. **Conflict resolution policy.** Cards are mostly last-write-wins on content.
   `review_logs` are **append-only and must merge, not overwrite** — two devices
   reviewing offline both contribute logs; the FSRS state is then recomputed
   from the merged log. This is the one place naive LWW corrupts data. Treat the
   review log as the source of truth and derive card scheduling state from it.

### 5.3 Backend architecture

- **Auth:** accounts (email/OAuth). This is the first time Pupil needs identity;
  today it proudly has "no account required" (`README`). Keep that for local
  use; require an account **only** for sync.
- **API:** a small sync service — `POST /sync/push` (changes since cursor),
  `GET /sync/pull` (server changes), plus auth and billing endpoints. A
  `RemoteStorage` adapter or a background sync worker speaks to it.
- **Store:** Postgres (or any durable DB) holding per-user rows mirroring the
  local schema. The server is a reconciliation point, not the app's brain — FSRS
  still runs client-side.
- **AI through the server (optional upsell):** once there is a backend, premium
  users can generate cards without bringing their own key; the server holds the
  provider key and meters usage. This removes the BYO-key friction noted in §3.
- **E2E encryption (optional, strong fit for the privacy brand):** because the
  client owns the data and the server only reconciles, you can encrypt card
  payloads client-side so the server stores ciphertext. Sells the "we can't read
  your data" story. Costs you server-side search/AI-on-content.

### 5.4 Monetization & billing

- **Free tier:** the entire local-first app (desktop, browser, mobile) — study,
  FSRS, AI with your own key, import/export. No account.
- **Paid tier (subscription):** cross-device cloud sync, server-side AI
  generation quota, hosted backup, possibly premium notifications/widgets.
- **Billing rails:** Stripe for web/desktop; **Apple/Google IAP is mandatory for
  subscriptions sold inside the mobile app.** A common pattern is to let users
  subscribe on the web (full margin via Stripe) and merely *unlock* on mobile,
  while still offering IAP for store compliance.
- **Entitlements:** the backend issues an entitlement the clients check before
  enabling sync UI. Keep the gating server-validated, not client-trusted.

---

## 6. Suggested sequencing

Each phase ships value and de-risks the next.

1. **Extract `@pupil/core` + formalize the `Storage` interface.** Pure
   refactor, no user-facing change. Unlocks everything else. (Resolves the
   duplication and "no shared package" gaps.)
2. **Ship the browser PWA** on IndexedDB/SQLite-wasm. OSS, low risk, immediate
   marketing/funnel value, exercises the new seam.
3. **Stand up accounts + the sync backend** with the schema changes from §5.2.
   Make sync a paid, opt-in toggle. Desktop and browser are the first sync
   clients.
4. **Ship the closed-source mobile app** (Tauri Mobile/Capacitor) in its own
   private repo consuming `@pupil/core`, with native SQLite + the sync adapter +
   IAP.
5. **Premium add-ons:** server-side AI quota, E2E encryption, mobile
   notifications/widgets.

## 7. Open questions to settle

- **Sync granularity & conflict policy** for review logs vs. card content — the
  one genuinely hard correctness problem here. Decide before coding the backend.
- **Open-core boundary:** exactly which modules are MIT `@pupil/core` vs.
  proprietary. Draw this line before the private mobile repo exists.
- **Hosting & data residency** for the sync backend, especially if you market on
  privacy.
- **Whether AI runs client-side (BYO key) or server-side (metered)** per tier.
- **Mobile billing path:** web-unlock vs. in-app IAP, given store-fee economics.
</content>
</invoke>
