import { createNewCardFsrsFields, type FsrsReviewGrade, scheduleCard } from "./fsrs";
import { invokeCommand } from "./ipc";
import { isTauriRuntime } from "./runtime";
import {
  createWebId,
  formatDayKey,
  readStoredWebSpaces,
  readWebArray,
  readWebCollection,
  type StoredWebSpace,
  WEB_STORAGE_KEYS,
  writeStoredWebSpaces,
  writeWebCollection,
} from "./web-store";

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
  suspended: boolean;
  explanation: string | null;
  explanationGeneratedAt: number | null;
};

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
    return invokeCommand<CardRecord[]>("list_cards", { spaceId: input.spaceId ?? null });
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
    return invokeCommand<CardRecord>("create_card", { input });
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
    suspended: false,
    explanation: null,
    explanationGeneratedAt: null,
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
    return invokeCommand<CardRecord>("update_card", { input });
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
    explanation: null,
    explanationGeneratedAt: null,
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
    await invokeCommand("delete_card", { id: input.id });
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

export async function suspendCard(input: { id: string; suspended: boolean }): Promise<CardRecord> {
  if (isTauriRuntime()) {
    return invokeCommand<CardRecord>("suspend_card", { input });
  }

  const cards = readWebCards();
  const cardIndex = cards.findIndex((card) => card.id === input.id);

  if (cardIndex === -1) {
    throw new Error("Card not found.");
  }

  const nextCard: CardRecord = {
    ...cards[cardIndex],
    suspended: input.suspended,
    updatedAt: Date.now(),
  };

  cards[cardIndex] = nextCard;
  writeWebCards(cards);

  return nextCard;
}

export async function reviewCard(input: {
  card: CardRecord;
  grade: FsrsReviewGrade;
  reviewedAt?: number;
}): Promise<CardRecord> {
  const reviewedAt = input.reviewedAt ?? Date.now();
  const scheduled = scheduleCard(input.card, input.grade, reviewedAt);

  if (isTauriRuntime()) {
    return invokeCommand<CardRecord>("review_card", {
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

export async function undoReviewCard(input: { snapshot: CardRecord }): Promise<CardRecord> {
  const { snapshot } = input;

  if (isTauriRuntime()) {
    return invokeCommand<CardRecord>("undo_review_card", {
      input: {
        difficulty: snapshot.difficulty,
        due: snapshot.due,
        elapsedDays: snapshot.elapsedDays,
        id: snapshot.id,
        lapses: snapshot.lapses,
        lastReview: snapshot.lastReview,
        learningSteps: snapshot.learningSteps,
        reps: snapshot.reps,
        scheduledDays: snapshot.scheduledDays,
        stability: snapshot.stability,
        state: snapshot.state,
      },
    });
  }

  const timestamp = Date.now();
  const cards = readWebCards();
  const cardIndex = cards.findIndex((card) => card.id === snapshot.id);

  if (cardIndex === -1) {
    throw new Error("Card not found.");
  }

  const restored: CardRecord = {
    ...cards[cardIndex],
    difficulty: snapshot.difficulty,
    due: snapshot.due,
    elapsedDays: snapshot.elapsedDays,
    lapses: snapshot.lapses,
    lastReview: snapshot.lastReview,
    learningSteps: snapshot.learningSteps,
    reps: snapshot.reps,
    scheduledDays: snapshot.scheduledDays,
    stability: snapshot.stability,
    state: snapshot.state,
    updatedAt: timestamp,
  };

  cards[cardIndex] = restored;
  writeWebCards(cards);

  const logs = readWebReviewLogs();
  const latestLogIndex = logs.findIndex((log) => log.cardId === snapshot.id);
  if (latestLogIndex !== -1) {
    writeWebReviewLogs([...logs.slice(0, latestLogIndex), ...logs.slice(latestLogIndex + 1)]);
  }

  touchWebSpace(restored.spaceId, readStoredWebSpaces(), timestamp);

  return restored;
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
  return readWebArray(WEB_STORAGE_KEYS.cards).flatMap(parseCardRecord).sort(sortCards);
}

function writeWebCards(cards: CardRecord[]): void {
  writeWebCollection(WEB_STORAGE_KEYS.cards, [...cards].sort(sortCards));
}

function touchWebSpace(spaceId: string, spaces: StoredWebSpace[], timestamp: number): void {
  const nextSpaces = spaces.map((space) =>
    space.id === spaceId ? { ...space, updatedAt: timestamp } : space,
  );

  writeStoredWebSpaces(nextSpaces);
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
      suspended: card.suspended === true,
      tags: card.tags.filter((tag): tag is string => typeof tag === "string"),
      updatedAt: card.updatedAt,
      explanation: typeof card.explanation === "string" ? card.explanation : null,
      explanationGeneratedAt:
        typeof card.explanationGeneratedAt === "number" ? card.explanationGeneratedAt : null,
    },
  ];
}

function readWebReviewLogs(): ReviewLogRecord[] {
  return readWebCollection(WEB_STORAGE_KEYS.reviewLogs, isReviewLogRecord);
}

function writeWebReviewLogs(logs: ReviewLogRecord[]): void {
  writeWebCollection(WEB_STORAGE_KEYS.reviewLogs, logs);
}

function readWebStudyDays(): StudyDayRecord[] {
  return readWebCollection(WEB_STORAGE_KEYS.studyDays, isStudyDayRecord);
}

function writeWebStudyDays(days: StudyDayRecord[]): void {
  writeWebCollection(WEB_STORAGE_KEYS.studyDays, days);
}

function upsertWebStudyDay(spaceId: string | null, reviewedAt: number): void {
  const day = formatDayKey(reviewedAt);
  const currentDays = readWebStudyDays();
  const exists = currentDays.some((entry) => entry.day === day && entry.spaceId === spaceId);

  if (exists) {
    return;
  }

  writeWebStudyDays([{ day, spaceId }, ...currentDays]);
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
