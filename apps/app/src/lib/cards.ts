import { invoke } from "@tauri-apps/api/core";
import {
  createNewCardFsrsFields,
  scheduleCard,
  type FsrsReviewGrade,
} from "./fsrs";
import { isTauriRuntime } from "./runtime";

export type CardSource = "manual" | "ai" | "anki";

export type CardRecord = {
  id: string;
  spaceId: string;
  spaceName: string;
  front: string;
  back: string;
  tags: string[];
  source: CardSource;
  state: number;
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  lastReview: number | null;
  createdAt: number;
  updatedAt: number;
};

type StoredWebSpace = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

const WEB_SPACE_STORAGE_KEY = "pupil.web.spaces";
const WEB_CARD_STORAGE_KEY = "pupil.web.cards";
const WEB_REVIEW_LOG_STORAGE_KEY = "pupil.web.review_logs";
const WEB_STUDY_DAY_STORAGE_KEY = "pupil.web.study_days";

type ReviewLogRecord = {
  id: string;
  cardId: string;
  due: number;
  elapsedDays: number | null;
  grade: FsrsReviewGrade;
  reviewTime: number;
  scheduledDays: number;
  spaceId: string;
  state: number;
};

type StudyDayRecord = {
  day: string;
  spaceId: string | null;
};

export async function listCards(input: { spaceId?: string } = {}): Promise<CardRecord[]> {
  if (isTauriRuntime()) {
    return invoke<CardRecord[]>("list_cards", { spaceId: input.spaceId ?? null });
  }

  const cards = readWebCards();

  return cards.filter((card) => (input.spaceId ? card.spaceId === input.spaceId : true));
}

export async function createCard(input: {
  spaceId: string;
  front: string;
  back: string;
  tags: string[];
  source?: CardSource;
}): Promise<CardRecord> {
  if (isTauriRuntime()) {
    return invoke<CardRecord>("create_card", { input });
  }

  const spaces = readStoredWebSpaces();
  const matchingSpace = spaces.find((space) => space.id === input.spaceId);

  if (!matchingSpace) {
    throw new Error("Space not found.");
  }

  const normalized = normalizeCardInput(input);
  const now = Date.now();
  const fsrsFields = createNewCardFsrsFields(now);
  const createdCard: CardRecord = {
    id: createWebId("card"),
    spaceId: matchingSpace.id,
    spaceName: matchingSpace.name,
    front: normalized.front,
    back: normalized.back,
    tags: normalized.tags,
    source: normalized.source,
    ...fsrsFields,
    createdAt: now,
    updatedAt: now,
  };

  writeWebCards([createdCard, ...readWebCards()]);
  touchWebSpace(matchingSpace.id, spaces, now);

  return createdCard;
}

export async function updateCard(input: {
  id: string;
  spaceId: string;
  front: string;
  back: string;
  tags: string[];
}): Promise<CardRecord> {
  if (isTauriRuntime()) {
    return invoke<CardRecord>("update_card", { input });
  }

  const normalized = normalizeCardInput(input);
  const cards = readWebCards();
  const cardIndex = cards.findIndex((card) => card.id === input.id);

  if (cardIndex === -1) {
    throw new Error("Card or space not found.");
  }

  const spaces = readStoredWebSpaces();
  const matchingSpace = spaces.find((space) => space.id === input.spaceId);

  if (!matchingSpace) {
    throw new Error("Space not found.");
  }

  const now = Date.now();
  const currentCard = cards[cardIndex];
  const nextCard: CardRecord = {
    ...currentCard,
    spaceId: matchingSpace.id,
    spaceName: matchingSpace.name,
    front: normalized.front,
    back: normalized.back,
    tags: normalized.tags,
    updatedAt: now,
  };

  cards[cardIndex] = nextCard;
  writeWebCards(cards);
  touchWebSpace(currentCard.spaceId, spaces, now);
  if (currentCard.spaceId !== matchingSpace.id) {
    touchWebSpace(matchingSpace.id, spaces, now);
  }

  return nextCard;
}

export async function deleteCard(input: { id: string }): Promise<void> {
  if (isTauriRuntime()) {
    await invoke("delete_card", { id: input.id });
    return;
  }

  const cards = readWebCards();
  const existingCard = cards.find((card) => card.id === input.id);

  if (!existingCard) {
    throw new Error("Card not found.");
  }

  writeWebCards(cards.filter((card) => card.id !== input.id));
  touchWebSpace(existingCard.spaceId, readStoredWebSpaces(), Date.now());
}

export async function reviewCard(input: {
  card: CardRecord;
  grade: FsrsReviewGrade;
  reviewedAt?: number;
}): Promise<CardRecord> {
  const reviewedAt = input.reviewedAt ?? Date.now();
  const scheduled = scheduleCard(input.card, input.grade, reviewedAt);

  if (isTauriRuntime()) {
    return invoke<CardRecord>("review_card", {
      input: {
        difficulty: scheduled.updatedCard.difficulty,
        due: scheduled.updatedCard.due,
        elapsedDays: scheduled.updatedCard.elapsedDays,
        grade: input.grade,
        id: input.card.id,
        lapses: scheduled.updatedCard.lapses,
        lastReview: scheduled.updatedCard.lastReview,
        learningSteps: scheduled.updatedCard.learningSteps,
        reps: scheduled.updatedCard.reps,
        reviewLog: {
          due: scheduled.reviewLog.due,
          elapsedDays: scheduled.reviewLog.elapsedDays,
          reviewTime: scheduled.reviewLog.reviewTime,
          scheduledDays: scheduled.reviewLog.scheduledDays,
          state: scheduled.reviewLog.state,
        },
        scheduledDays: scheduled.updatedCard.scheduledDays,
        stability: scheduled.updatedCard.stability,
        state: scheduled.updatedCard.state,
      },
    });
  }

  const cards = readWebCards();
  const cardIndex = cards.findIndex((card) => card.id === input.card.id);

  if (cardIndex === -1) {
    throw new Error("Card not found.");
  }

  const nextCard: CardRecord = {
    ...cards[cardIndex],
    ...scheduled.updatedCard,
    updatedAt: scheduled.reviewLog.reviewTime,
  };

  cards[cardIndex] = nextCard;
  writeWebCards(cards);
  writeWebReviewLogs([
    {
      cardId: nextCard.id,
      due: scheduled.reviewLog.due,
      elapsedDays: scheduled.reviewLog.elapsedDays,
      grade: input.grade,
      id: createWebId("review"),
      reviewTime: scheduled.reviewLog.reviewTime,
      scheduledDays: scheduled.reviewLog.scheduledDays,
      spaceId: nextCard.spaceId,
      state: scheduled.reviewLog.state,
    },
    ...readWebReviewLogs(),
  ]);
  upsertWebStudyDay(nextCard.spaceId, scheduled.reviewLog.reviewTime);
  upsertWebStudyDay(null, scheduled.reviewLog.reviewTime);
  touchWebSpace(nextCard.spaceId, readStoredWebSpaces(), scheduled.reviewLog.reviewTime);

  return nextCard;
}

function normalizeCardInput(input: {
  spaceId: string;
  front: string;
  back: string;
  tags: string[];
  source?: CardSource;
}): {
  front: string;
  back: string;
  tags: string[];
  source: CardSource;
} {
  const front = input.front.trim();
  const back = input.back.trim();

  if (!input.spaceId.trim()) {
    throw new Error("Space identifier is required.");
  }

  if (!front) {
    throw new Error("Front can't be empty.");
  }

  if (!back) {
    throw new Error("Back can't be empty.");
  }

  return {
    front,
    back,
    tags: normalizeTags(input.tags),
    source: normalizeSource(input.source),
  };
}

function normalizeSource(source?: CardSource): CardSource {
  if (source === "ai" || source === "anki" || source === "manual") {
    return source;
  }

  return "manual";
}

function normalizeTags(tags: string[]): string[] {
  const normalized: string[] = [];

  for (const tag of tags) {
    const trimmed = tag.trim();

    if (!trimmed || normalized.includes(trimmed)) {
      continue;
    }

    normalized.push(trimmed);
  }

  return normalized;
}

function readWebCards(): CardRecord[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  const raw = window.localStorage.getItem(WEB_CARD_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap(parseCardRecord).sort(sortCards);
  } catch {
    return [];
  }
}

function writeWebCards(cards: CardRecord[]): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(WEB_CARD_STORAGE_KEY, JSON.stringify([...cards].sort(sortCards)));
}

function touchWebSpace(spaceId: string, spaces: StoredWebSpace[], timestamp: number): void {
  const nextSpaces = spaces.map((space) =>
    space.id === spaceId ? { ...space, updatedAt: timestamp } : space,
  );

  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(
    WEB_SPACE_STORAGE_KEY,
    JSON.stringify(nextSpaces.sort((left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt)),
  );
}

function readStoredWebSpaces(): StoredWebSpace[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  const raw = window.localStorage.getItem(WEB_SPACE_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isStoredWebSpace);
  } catch {
    return [];
  }
}

function createWebId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sortCards(left: CardRecord, right: CardRecord): number {
  return right.updatedAt - left.updatedAt || right.createdAt - left.createdAt;
}

function parseCardRecord(value: unknown): CardRecord[] {
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
      difficulty: typeof card.difficulty === "number" ? card.difficulty : 0,
      due: card.due,
      elapsedDays: typeof card.elapsedDays === "number" ? card.elapsedDays : 0,
      front: card.front,
      id: card.id,
      lapses: typeof card.lapses === "number" ? card.lapses : 0,
      lastReview: typeof card.lastReview === "number" ? card.lastReview : null,
      learningSteps: typeof card.learningSteps === "number" ? card.learningSteps : 0,
      reps: typeof card.reps === "number" ? card.reps : 0,
      scheduledDays: typeof card.scheduledDays === "number" ? card.scheduledDays : 0,
      source: normalizeSource(card.source),
      spaceId: card.spaceId,
      spaceName: card.spaceName,
      stability: typeof card.stability === "number" ? card.stability : 0,
      state: card.state,
      tags: card.tags.filter((tag): tag is string => typeof tag === "string"),
      updatedAt: card.updatedAt,
    },
  ];
}

function isStoredWebSpace(value: unknown): value is StoredWebSpace {
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

function readWebReviewLogs(): ReviewLogRecord[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  const raw = window.localStorage.getItem(WEB_REVIEW_LOG_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isReviewLogRecord);
  } catch {
    return [];
  }
}

function writeWebReviewLogs(logs: ReviewLogRecord[]): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(WEB_REVIEW_LOG_STORAGE_KEY, JSON.stringify(logs));
}

function readWebStudyDays(): StudyDayRecord[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  const raw = window.localStorage.getItem(WEB_STUDY_DAY_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isStudyDayRecord);
  } catch {
    return [];
  }
}

function writeWebStudyDays(days: StudyDayRecord[]): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(WEB_STUDY_DAY_STORAGE_KEY, JSON.stringify(days));
}

function upsertWebStudyDay(spaceId: string | null, reviewedAt: number): void {
  const day = formatStudyDay(reviewedAt);
  const currentDays = readWebStudyDays();
  const exists = currentDays.some(
    (entry) => entry.day === day && entry.spaceId === spaceId,
  );

  if (exists) {
    return;
  }

  writeWebStudyDays([{ day, spaceId }, ...currentDays]);
}

function formatStudyDay(timestamp: number): string {
  const value = new Date(timestamp);
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isReviewLogRecord(value: unknown): value is ReviewLogRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const log = value as Partial<ReviewLogRecord>;

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

function isStudyDayRecord(value: unknown): value is StudyDayRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const day = value as Partial<StudyDayRecord>;
  return typeof day.day === "string" && (typeof day.spaceId === "string" || day.spaceId === null);
}
