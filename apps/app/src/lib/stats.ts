import { invokeCommand } from "./ipc";
import { isTauriRuntime } from "./runtime";
import { formatDayKey, readWebCollection, WEB_STORAGE_KEYS } from "./web-store";

export type DashboardStats = {
  dueToday: number;
  globalStreak: number;
  studiedToday: number;
  studyDays: string[];
  totalCards: number;
};

export type SpaceStats = {
  retention30d: number | null;
  reviewActivity7d: number[];
  spaceId: string;
};

type StoredWebCard = {
  due: number;
  spaceId: string;
};

type StoredReviewLog = {
  grade: number;
  reviewTime: number;
  spaceId: string;
};

type StoredStudyDay = {
  day: string;
  spaceId: string | null;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  if (isTauriRuntime()) {
    return invokeCommand<DashboardStats>("get_dashboard_stats");
  }

  const cards = readStoredCards();
  const reviewLogs = readStoredReviewLogs();
  const studyDays = readStoredStudyDays();
  const now = Date.now();
  const today = formatDayKey(now);

  return {
    dueToday: cards.filter((card) => card.due <= now).length,
    globalStreak: computeStreak(
      studyDays.filter((entry) => entry.spaceId === null).map((entry) => entry.day),
      today,
    ),
    studiedToday: reviewLogs.filter((log) => formatDayKey(log.reviewTime) === today).length,
    studyDays: studyDays.filter((entry) => entry.spaceId === null).map((entry) => entry.day),
    totalCards: cards.length,
  };
}

export async function listSpaceStats(): Promise<SpaceStats[]> {
  if (isTauriRuntime()) {
    return invokeCommand<SpaceStats[]>("list_space_stats");
  }

  const reviewLogs = readStoredReviewLogs();
  const now = Date.now();
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;
  const spaceIds = Array.from(new Set(reviewLogs.map((log) => log.spaceId)));

  return spaceIds.map((spaceId) => {
    const logs = reviewLogs.filter((log) => log.spaceId === spaceId);
    const recentLogs = logs.filter((log) => log.reviewTime >= cutoff);
    const successfulReviews = recentLogs.filter((log) => log.grade >= 3).length;

    return {
      retention30d: recentLogs.length > 0 ? (successfulReviews / recentLogs.length) * 100 : null,
      reviewActivity7d: buildReviewActivity7d(logs, now),
      spaceId,
    };
  });
}

function buildReviewActivity7d(logs: StoredReviewLog[], now: number) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(startOfToday);
    day.setDate(startOfToday.getDate() - (6 - index));
    const currentDay = formatDayKey(day.getTime());

    return logs.filter((log) => formatDayKey(log.reviewTime) === currentDay).length;
  });
}

function isStoredWebCard(value: unknown): value is StoredWebCard {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as StoredWebCard).spaceId === "string" &&
    typeof (value as StoredWebCard).due === "number"
  );
}

function isStoredReviewLog(value: unknown): value is StoredReviewLog {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as StoredReviewLog).spaceId === "string" &&
    typeof (value as StoredReviewLog).grade === "number" &&
    typeof (value as StoredReviewLog).reviewTime === "number"
  );
}

function isStoredStudyDay(value: unknown): value is StoredStudyDay {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as StoredStudyDay).day === "string" &&
    (typeof (value as StoredStudyDay).spaceId === "string" ||
      (value as StoredStudyDay).spaceId === null)
  );
}

function readStoredCards(): StoredWebCard[] {
  return readWebCollection(WEB_STORAGE_KEYS.cards, isStoredWebCard);
}

function readStoredReviewLogs(): StoredReviewLog[] {
  return readWebCollection(WEB_STORAGE_KEYS.reviewLogs, isStoredReviewLog);
}

function readStoredStudyDays(): StoredStudyDay[] {
  return readWebCollection(WEB_STORAGE_KEYS.studyDays, isStoredStudyDay);
}

function computeStreak(days: string[], today: string) {
  const daySet = new Set(days);
  let streak = 0;
  const cursor = new Date(`${today}T00:00:00`);

  if (!daySet.has(today)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (daySet.has(formatDayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
