/**
 * Centralized localStorage-backed persistence used by the web fallback of
 * every domain module (the non-Tauri runtime). Keeps the availability guard,
 * JSON (de)serialization, storage keys, and shared web record types in one
 * place so domain modules don't each re-implement them.
 */

export const WEB_STORAGE_KEYS = {
  aiSettings: "pupil.ai.settings",
  cards: "pupil.web.cards",
  importHistory: "pupil.web.import-history",
  reviewLogs: "pupil.web.review_logs",
  spaces: "pupil.web.spaces",
  studyDays: "pupil.web.study_days",
  studySettings: "pupil.web.study_settings",
} as const;

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

/** Returns the parsed JSON array at `key`, or [] when missing/invalid. */
export function readWebArray(key: string): unknown[] {
  const storage = getLocalStorage();

  if (!storage) {
    return [];
  }

  const raw = storage.getItem(key);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Reads the array at `key` and keeps only entries matching `isValid`. */
export function readWebCollection<T>(key: string, isValid: (value: unknown) => value is T): T[] {
  return readWebArray(key).filter(isValid);
}

export function writeWebCollection<T>(key: string, value: T[]): void {
  getLocalStorage()?.setItem(key, JSON.stringify(value));
}

/** Reads a single JSON value at `key`, or null when missing/invalid. */
export function readWebValue<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  const raw = readWebString(key);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeWebValue<T>(key: string, value: T): void {
  getLocalStorage()?.setItem(key, JSON.stringify(value));
}

export function readWebString(key: string): string | null {
  return getLocalStorage()?.getItem(key) ?? null;
}

export function writeWebString(key: string, value: string): void {
  getLocalStorage()?.setItem(key, value);
}

export function removeWebKey(key: string): void {
  getLocalStorage()?.removeItem(key);
}

export function createWebId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** YYYY-MM-DD key in local time, shared by stats, scheduling, and check-ins. */
export function formatDayKey(timestamp: number): string {
  const value = new Date(timestamp);
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type StoredWebSpace = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export function isStoredWebSpace(value: unknown): value is StoredWebSpace {
  if (!value || typeof value !== "object") {
    return false;
  }

  const space = value as Partial<StoredWebSpace>;

  return (
    typeof space.id === "string" &&
    typeof space.name === "string" &&
    typeof space.createdAt === "number" &&
    typeof space.updatedAt === "number"
  );
}

export function sortStoredWebSpaces(spaces: StoredWebSpace[]): StoredWebSpace[] {
  return [...spaces].sort(
    (left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt,
  );
}

export function readStoredWebSpaces(): StoredWebSpace[] {
  return sortStoredWebSpaces(readWebCollection(WEB_STORAGE_KEYS.spaces, isStoredWebSpace));
}

export function writeStoredWebSpaces(spaces: StoredWebSpace[]): void {
  writeWebCollection(WEB_STORAGE_KEYS.spaces, sortStoredWebSpaces(spaces));
}
