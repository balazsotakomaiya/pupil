import {
  buildStudyQueueSnapshot,
  type CardRecord,
  computeNewCardsBudget,
  computeStreak,
  createNewCardFsrsFields,
  type DashboardStats,
  DEFAULT_NEW_CARDS_LIMIT,
  formatDayKey,
  normalizeCardInput,
  normalizeSpaceName,
  type PupilStorage,
  type RecentActivityRecord,
  type SpaceStats,
  type SpaceSummary,
  type StudyQueueSnapshotData,
  type StudySettings,
  scheduleCard,
  spaceNameKey,
  toStudyQueueSnapshotData,
} from "@pupil/core";
import {
  byRecencyDesc,
  clearAll,
  createId,
  readCards,
  readNewCardsLimit,
  readReviewLogs,
  readSpaces,
  readStudyDays,
  type StoredSpace,
  touchSpace,
  writeCards,
  writeNewCardsLimit,
  writeReviewLogs,
  writeSpaces,
  writeStudyDays,
} from "./web-store";

const RECENT_ACTIVITY_SESSION_GAP_MS = 30 * 60 * 1000;
const MAX_RECENT_ACTIVITY_ROWS = 5;
const RETENTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Browser-only storage backed by local web storage.
 *
 * This is the fallback used when the app runs outside the Tauri shell. It is
 * deliberately simple — a durable browser surface will replace it with an
 * IndexedDB/SQLite-wasm implementation of this same interface.
 */
export function createWebStorage(): PupilStorage {
  return {
    async listSpaces() {
      const cards = readCards();
      const now = Date.now();

      return readSpaces()
        .map((space) => toSpaceSummary(space, cards, now))
        .sort(byRecencyDesc);
    },

    async createSpace(input) {
      const name = normalizeSpaceName(input.name);
      const spaces = readSpaces();

      ensureUniqueName(spaces, name);

      const now = Date.now();
      const created: StoredSpace = { createdAt: now, id: createId("space"), name, updatedAt: now };

      writeSpaces([created, ...spaces]);

      return toSpaceSummary(created, readCards(), now);
    },

    async renameSpace(input) {
      const name = normalizeSpaceName(input.name);
      const spaces = readSpaces();
      const index = spaces.findIndex((space) => space.id === input.id);

      if (index === -1) {
        throw new Error("Space not found.");
      }

      ensureUniqueName(spaces, name, input.id);

      const now = Date.now();
      const renamed: StoredSpace = { ...spaces[index], name, updatedAt: now };

      spaces[index] = renamed;
      writeSpaces(spaces);

      writeCards(
        readCards().map((card) =>
          card.spaceId === input.id ? { ...card, spaceName: name } : card,
        ),
      );
      writeReviewLogs(
        readReviewLogs().map((log) =>
          log.spaceId === input.id ? { ...log, spaceName: name } : log,
        ),
      );

      return toSpaceSummary(renamed, readCards(), now);
    },

    async deleteSpace(input) {
      const spaces = readSpaces();
      const remaining = spaces.filter((space) => space.id !== input.id);

      if (remaining.length === spaces.length) {
        throw new Error("Space not found.");
      }

      writeSpaces(remaining);
      writeCards(readCards().filter((card) => card.spaceId !== input.id));
    },

    async listCards(input = {}) {
      const cards = readCards();

      return input.spaceId ? cards.filter((card) => card.spaceId === input.spaceId) : cards;
    },

    async createCard(input) {
      const space = requireSpace(input.spaceId);
      const normalized = normalizeCardInput(input);
      const now = Date.now();
      const created: CardRecord = {
        ...createNewCardFsrsFields(now),
        back: normalized.back,
        createdAt: now,
        front: normalized.front,
        id: createId("card"),
        source: normalized.source,
        spaceId: space.id,
        spaceName: space.name,
        suspended: false,
        tags: normalized.tags,
        updatedAt: now,
      };

      writeCards([created, ...readCards()]);
      touchSpace(space.id, now);

      return created;
    },

    async updateCard(input) {
      const normalized = normalizeCardInput(input);
      const cards = readCards();
      const index = cards.findIndex((card) => card.id === input.id);

      if (index === -1) {
        throw new Error("Card or space not found.");
      }

      const space = requireSpace(input.spaceId);
      const now = Date.now();
      const previous = cards[index];
      const updated: CardRecord = {
        ...previous,
        back: normalized.back,
        front: normalized.front,
        spaceId: space.id,
        spaceName: space.name,
        tags: normalized.tags,
        updatedAt: now,
      };

      cards[index] = updated;
      writeCards(cards);
      touchSpace(previous.spaceId, now);

      if (previous.spaceId !== space.id) {
        touchSpace(space.id, now);
      }

      return updated;
    },

    async deleteCard(input) {
      const cards = readCards();
      const existing = cards.find((card) => card.id === input.id);

      if (!existing) {
        throw new Error("Card not found.");
      }

      writeCards(cards.filter((card) => card.id !== input.id));
      touchSpace(existing.spaceId, Date.now());
    },

    async suspendCard(input) {
      const cards = readCards();
      const index = cards.findIndex((card) => card.id === input.id);

      if (index === -1) {
        throw new Error("Card not found.");
      }

      const updated: CardRecord = {
        ...cards[index],
        suspended: input.suspended,
        updatedAt: Date.now(),
      };

      cards[index] = updated;
      writeCards(cards);

      return updated;
    },

    async reviewCard(input) {
      const reviewedAt = input.reviewedAt ?? Date.now();
      const scheduled = scheduleCard(input.card, input.grade, reviewedAt);
      const cards = readCards();
      const index = cards.findIndex((card) => card.id === input.card.id);

      if (index === -1) {
        throw new Error("Card not found.");
      }

      const reviewed: CardRecord = {
        ...cards[index],
        ...scheduled.updatedCard,
        updatedAt: scheduled.reviewLog.reviewTime,
      };

      cards[index] = reviewed;
      writeCards(cards);
      writeReviewLogs([
        {
          cardId: reviewed.id,
          due: scheduled.reviewLog.due,
          elapsedDays: scheduled.reviewLog.elapsedDays,
          grade: input.grade,
          id: createId("review"),
          reviewTime: scheduled.reviewLog.reviewTime,
          scheduledDays: scheduled.reviewLog.scheduledDays,
          spaceId: reviewed.spaceId,
          spaceName: reviewed.spaceName,
          state: scheduled.reviewLog.state,
        },
        ...readReviewLogs(),
      ]);
      upsertStudyDay(reviewed.spaceId, scheduled.reviewLog.reviewTime);
      upsertStudyDay(null, scheduled.reviewLog.reviewTime);
      touchSpace(reviewed.spaceId, scheduled.reviewLog.reviewTime);

      return reviewed;
    },

    async undoReviewCard(input) {
      const { snapshot } = input;
      const now = Date.now();
      const cards = readCards();
      const index = cards.findIndex((card) => card.id === snapshot.id);

      if (index === -1) {
        throw new Error("Card not found.");
      }

      const restored: CardRecord = {
        ...cards[index],
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
        updatedAt: now,
      };

      cards[index] = restored;
      writeCards(cards);

      const logs = readReviewLogs();
      const latest = logs.findIndex((log) => log.cardId === snapshot.id);

      if (latest !== -1) {
        writeReviewLogs([...logs.slice(0, latest), ...logs.slice(latest + 1)]);
      }

      touchSpace(restored.spaceId, now);

      return restored;
    },

    async getDashboardStats(): Promise<DashboardStats> {
      const cards = readCards();
      const reviewLogs = readReviewLogs();
      const globalDays = readStudyDays()
        .filter((entry) => entry.spaceId === null)
        .map((entry) => entry.day);
      const now = Date.now();
      const today = formatDayKey(now);

      return {
        dueToday: cards.filter((card) => card.due <= now).length,
        globalStreak: computeStreak(globalDays, today),
        studiedToday: reviewLogs.filter((log) => formatDayKey(log.reviewTime) === today).length,
        studyDays: globalDays,
        totalCards: cards.length,
      };
    },

    async listSpaceStats(): Promise<SpaceStats[]> {
      const reviewLogs = readReviewLogs();
      const now = Date.now();
      const cutoff = now - RETENTION_WINDOW_MS;

      return Array.from(new Set(reviewLogs.map((log) => log.spaceId))).map((spaceId) => {
        const logs = reviewLogs.filter((log) => log.spaceId === spaceId);
        const recent = logs.filter((log) => log.reviewTime >= cutoff);
        const successful = recent.filter((log) => log.grade >= 3).length;

        return {
          retention30d: recent.length > 0 ? (successful / recent.length) * 100 : null,
          reviewActivity7d: buildReviewActivity7d(logs, now),
          spaceId,
        };
      });
    },

    async listRecentActivity(): Promise<RecentActivityRecord[]> {
      const logs = readReviewLogs().sort((left, right) => right.reviewTime - left.reviewTime);
      const sessions: RecentActivityRecord[] = [];

      for (const log of logs) {
        const current = sessions.at(-1);
        const continuesSession =
          !!current &&
          current.spaceId === log.spaceId &&
          current.reviewTime - log.reviewTime <= RECENT_ACTIVITY_SESSION_GAP_MS;

        if (continuesSession && current) {
          current.reviewCount += 1;
          continue;
        }

        if (sessions.length >= MAX_RECENT_ACTIVITY_ROWS) {
          break;
        }

        sessions.push({
          id: `${log.spaceId}:${log.reviewTime}`,
          reviewCount: 1,
          reviewTime: log.reviewTime,
          spaceId: log.spaceId,
          spaceName: log.spaceName ?? "Space",
        });
      }

      return sessions;
    },

    async getStudySettings(): Promise<StudySettings> {
      return {
        newCardsLimit: readNewCardsLimit(DEFAULT_NEW_CARDS_LIMIT),
        newCardsToday: countNewCardsToday(),
      };
    },

    async saveStudySettings(newCardsLimit) {
      writeNewCardsLimit(newCardsLimit);

      return {
        newCardsLimit,
        newCardsToday: countNewCardsToday(),
      };
    },

    async getStudyQueueSnapshot(): Promise<StudyQueueSnapshotData> {
      const newCardsLimit = readNewCardsLimit(DEFAULT_NEW_CARDS_LIMIT);

      return toStudyQueueSnapshotData(
        buildStudyQueueSnapshot(
          readCards(),
          Date.now(),
          computeNewCardsBudget(newCardsLimit, countNewCardsToday()),
        ),
      );
    },
  };
}

/** Exposed for the settings "reset all data" action, which clears the same store. */
export function clearWebStorage(): void {
  clearAll();
}

function requireSpace(spaceId: string): StoredSpace {
  const space = readSpaces().find((entry) => entry.id === spaceId);

  if (!space) {
    throw new Error("Space not found.");
  }

  return space;
}

function ensureUniqueName(spaces: StoredSpace[], name: string, ignoreId?: string): void {
  const key = spaceNameKey(name);
  const conflict = spaces.some(
    (space) => space.id !== ignoreId && spaceNameKey(space.name) === key,
  );

  if (conflict) {
    throw new Error("A space with that name already exists.");
  }
}

function toSpaceSummary(space: StoredSpace, cards: CardRecord[], now: number): SpaceSummary {
  const spaceCards = cards.filter((card) => card.spaceId === space.id);

  return {
    cardCount: spaceCards.length,
    createdAt: space.createdAt,
    dueTodayCount: spaceCards.filter((card) => card.due <= now).length,
    id: space.id,
    name: space.name,
    streak: 0,
    updatedAt: space.updatedAt,
  };
}

function upsertStudyDay(spaceId: string | null, reviewedAt: number): void {
  const day = formatDayKey(reviewedAt);
  const days = readStudyDays();

  if (days.some((entry) => entry.day === day && entry.spaceId === spaceId)) {
    return;
  }

  writeStudyDays([{ day, spaceId }, ...days]);
}

function countNewCardsToday(): number {
  const today = formatDayKey(Date.now());
  const seen = new Set<string>();

  for (const log of readReviewLogs()) {
    if (log.state === 0 && formatDayKey(log.reviewTime) === today) {
      seen.add(log.cardId);
    }
  }

  return seen.size;
}

function buildReviewActivity7d(logs: { reviewTime: number }[], now: number): number[] {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(startOfToday);
    day.setDate(startOfToday.getDate() - (6 - index));
    const dayKey = formatDayKey(day.getTime());

    return logs.filter((log) => formatDayKey(log.reviewTime) === dayKey).length;
  });
}
