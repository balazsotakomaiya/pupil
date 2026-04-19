import { invokeCommand } from "./ipc";
import { isTauriRuntime } from "./runtime";

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

const WEB_CARD_STORAGE_KEY = "pupil.web.cards";
const WEB_REVIEW_LOG_STORAGE_KEY = "pupil.web.review_logs";
const WEB_STUDY_DAY_STORAGE_KEY = "pupil.web.study_days";

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
  const today = formatStudyDay(now);

  return {
    dueToday: cards.filter((card) => card.due <= now).length,
    globalStreak: computeStreak(
      studyDays.filter((entry) => entry.spaceId === null).map((entry) => entry.day),
      today,
    ),
    studiedToday: reviewLogs.filter((log) => formatStudyDay(log.reviewTime) === today).length,
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
    const currentDay = formatStudyDay(day.getTime());

    return logs.filter((log) => formatStudyDay(log.reviewTime) === currentDay).length;
  });
}

function readStoredCards(): StoredWebCard[] {
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

    return parsed.filter(
      (value): value is StoredWebCard =>
        !!value &&
        typeof value === "object" &&
        typeof (value as StoredWebCard).spaceId === "string" &&
        typeof (value as StoredWebCard).due === "number",
    );
  } catch {
    return [];
  }
}

function readStoredReviewLogs(): StoredReviewLog[] {
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

    return parsed.filter(
      (value): value is StoredReviewLog =>
        !!value &&
        typeof value === "object" &&
        typeof (value as StoredReviewLog).spaceId === "string" &&
        typeof (value as StoredReviewLog).grade === "number" &&
        typeof (value as StoredReviewLog).reviewTime === "number",
    );
  } catch {
    return [];
  }
}

function readStoredStudyDays(): StoredStudyDay[] {
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

    return parsed.filter(
      (value): value is StoredStudyDay =>
        !!value &&
        typeof value === "object" &&
        typeof (value as StoredStudyDay).day === "string" &&
        (typeof (value as StoredStudyDay).spaceId === "string" ||
          (value as StoredStudyDay).spaceId === null),
    );
  } catch {
    return [];
  }
}

function computeStreak(days: string[], today: string) {
  const daySet = new Set(days);
  let streak = 0;
  const cursor = new Date(`${today}T00:00:00`);

  if (!daySet.has(today)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (daySet.has(formatStudyDay(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function formatStudyDay(timestamp: number) {
  const value = new Date(timestamp);
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
