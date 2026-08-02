import {
  type CardRecord,
  normalizeCardSource,
  type ReviewLogRecord,
  type StudyDayRecord,
} from "@pupil/core";

/**
 * Local web-storage primitives behind `WebStorage`.
 *
 * Reading and parsing used to be reimplemented in every data module, each with
 * its own partial shape and guard. Keeping it here means one definition of what
 * is on disk in browser-only mode.
 */
export const WEB_STORAGE_KEYS = {
  aiSettings: "pupil.ai.settings",
  cards: "pupil.web.cards",
  reviewLogs: "pupil.web.review_logs",
  spaces: "pupil.web.spaces",
  studyDays: "pupil.web.study_days",
  studySettings: "pupil.web.study_settings",
} as const;

export const ALL_WEB_STORAGE_KEYS: string[] = Object.values(WEB_STORAGE_KEYS);

export type StoredSpace = {
  createdAt: number;
  id: string;
  name: string;
  updatedAt: number;
};

/** Review logs carry the space name so activity survives a space rename. */
export type StoredReviewLog = ReviewLogRecord & {
  spaceName?: string;
};

function localStore(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function readRaw(key: string): unknown[] {
  const store = localStore();

  if (!store) {
    return [];
  }

  const raw = store.getItem(key);

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

function writeRaw(key: string, value: unknown): void {
  localStore()?.setItem(key, JSON.stringify(value));
}

export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function byRecencyDesc(
  left: { createdAt: number; updatedAt: number },
  right: { createdAt: number; updatedAt: number },
): number {
  return right.updatedAt - left.updatedAt || right.createdAt - left.createdAt;
}

export function readSpaces(): StoredSpace[] {
  return readRaw(WEB_STORAGE_KEYS.spaces).filter(isStoredSpace).sort(byRecencyDesc);
}

export function writeSpaces(spaces: StoredSpace[]): void {
  writeRaw(WEB_STORAGE_KEYS.spaces, [...spaces].sort(byRecencyDesc));
}

export function touchSpace(spaceId: string, timestamp: number): void {
  writeSpaces(
    readSpaces().map((space) =>
      space.id === spaceId ? { ...space, updatedAt: timestamp } : space,
    ),
  );
}

export function readCards(): CardRecord[] {
  return readRaw(WEB_STORAGE_KEYS.cards).flatMap(parseCard).sort(byRecencyDesc);
}

export function writeCards(cards: CardRecord[]): void {
  writeRaw(WEB_STORAGE_KEYS.cards, [...cards].sort(byRecencyDesc));
}

export function readReviewLogs(): StoredReviewLog[] {
  return readRaw(WEB_STORAGE_KEYS.reviewLogs).filter(isStoredReviewLog);
}

export function writeReviewLogs(logs: StoredReviewLog[]): void {
  writeRaw(WEB_STORAGE_KEYS.reviewLogs, logs);
}

export function readStudyDays(): StudyDayRecord[] {
  return readRaw(WEB_STORAGE_KEYS.studyDays).filter(isStudyDay);
}

export function writeStudyDays(days: StudyDayRecord[]): void {
  writeRaw(WEB_STORAGE_KEYS.studyDays, days);
}

export function readNewCardsLimit(fallback: number): number | null {
  const store = localStore();
  const raw = store?.getItem(WEB_STORAGE_KEYS.studySettings);

  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as { newCardsLimit?: number | null };

    if (parsed.newCardsLimit === null) {
      return null;
    }

    if (typeof parsed.newCardsLimit === "number" && parsed.newCardsLimit > 0) {
      return parsed.newCardsLimit;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export function writeNewCardsLimit(newCardsLimit: number | null): void {
  writeRaw(WEB_STORAGE_KEYS.studySettings, { newCardsLimit });
}

export function clearAll(): void {
  const store = localStore();

  for (const key of ALL_WEB_STORAGE_KEYS) {
    store?.removeItem(key);
  }
}

function isStoredSpace(value: unknown): value is StoredSpace {
  if (!value || typeof value !== "object") {
    return false;
  }

  const space = value as Partial<StoredSpace>;

  return (
    typeof space.id === "string" &&
    typeof space.name === "string" &&
    typeof space.createdAt === "number" &&
    typeof space.updatedAt === "number"
  );
}

function isStoredReviewLog(value: unknown): value is StoredReviewLog {
  if (!value || typeof value !== "object") {
    return false;
  }

  const log = value as Partial<StoredReviewLog>;

  return (
    typeof log.id === "string" &&
    typeof log.cardId === "string" &&
    typeof log.spaceId === "string" &&
    typeof log.grade === "number" &&
    typeof log.state === "number" &&
    typeof log.due === "number" &&
    (typeof log.elapsedDays === "number" || log.elapsedDays === null) &&
    typeof log.scheduledDays === "number" &&
    typeof log.reviewTime === "number"
  );
}

function isStudyDay(value: unknown): value is StudyDayRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const day = value as Partial<StudyDayRecord>;

  return typeof day.day === "string" && (typeof day.spaceId === "string" || day.spaceId === null);
}

function parseCard(value: unknown): CardRecord[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const card = value as Partial<CardRecord> & Record<string, unknown>;

  if (
    typeof card.id !== "string" ||
    typeof card.spaceId !== "string" ||
    typeof card.spaceName !== "string" ||
    typeof card.front !== "string" ||
    typeof card.back !== "string" ||
    !Array.isArray(card.tags) ||
    typeof card.source !== "string" ||
    typeof card.state !== "number" ||
    typeof card.due !== "number" ||
    typeof card.createdAt !== "number" ||
    typeof card.updatedAt !== "number"
  ) {
    return [];
  }

  return [
    {
      back: card.back,
      createdAt: card.createdAt,
      difficulty: numberOr(card.difficulty, 0),
      due: card.due,
      elapsedDays: numberOr(card.elapsedDays, 0),
      front: card.front,
      id: card.id,
      lapses: numberOr(card.lapses, 0),
      lastReview: numberOrNull(card.lastReview),
      learningSteps: numberOr(card.learningSteps, 0),
      reps: numberOr(card.reps, 0),
      scheduledDays: numberOr(card.scheduledDays, 0),
      source: normalizeCardSource(card.source),
      spaceId: card.spaceId,
      spaceName: card.spaceName,
      stability: numberOr(card.stability, 0),
      state: card.state,
      suspended: card.suspended === true,
      tags: card.tags.filter((tag): tag is string => typeof tag === "string"),
      updatedAt: card.updatedAt,
    },
  ];
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}
