import type { PupilStorage } from "@pupil/core";
import { isTauriRuntime } from "../runtime";
import { createTauriStorage } from "./tauri";
import { createWebStorage } from "./web";

let activeStorage: PupilStorage | null = null;

/**
 * Picks the storage implementation for the current runtime.
 *
 * This is the only place the app asks *where* data lives. Adding a browser
 * (IndexedDB), mobile (native SQLite), or sync-backed implementation means
 * adding a branch here, not touching call sites.
 */
export function createStorage(): PupilStorage {
  return isTauriRuntime() ? createTauriStorage() : createWebStorage();
}

/**
 * The active storage instance.
 *
 * Resolved once on first use rather than per call: the Tauri shell injects its
 * globals before app code runs, so the runtime cannot change mid-session.
 */
export function getStorage(): PupilStorage {
  activeStorage ??= createStorage();

  return activeStorage;
}

/** Overrides the active instance. Intended for tests and alternate shells. */
export function setStorage(storage: PupilStorage | null): void {
  activeStorage = storage;
}

export { createTauriStorage } from "./tauri";
export { clearWebStorage, createWebStorage } from "./web";
