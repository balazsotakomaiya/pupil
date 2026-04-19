import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./runtime";

export type StudySettings = {
  newCardsLimit: number | null;
  newCardsToday: number;
};

const WEB_STUDY_SETTINGS_KEY = "pupil.web.study_settings";
const WEB_REVIEW_LOG_STORAGE_KEY = "pupil.web.review_logs";

/**
 * Average number of reviews a single new card generates within 30 days at
 * ~90 % retention.  Derived from Wozniak's SuperMemo long-term data and
 * confirmed by Anki community benchmarks.
 */
const REVIEW_MULTIPLIER_30D = 7;

export type NewCardsPreset = {
  description: string;
  label: string;
  value: number | null;
  warn?: boolean;
};

export const NEW_CARDS_PRESETS: NewCardsPreset[] = [
  { label: "Light", value: 10, description: "10 new cards / day" },
  { label: "Moderate", value: 20, description: "20 new cards / day" },
  { label: "Intensive", value: 50, description: "50 new cards / day", warn: true },
  { label: "Heavy", value: 100, description: "100 new cards / day", warn: true },
  { label: "No limit", value: null, description: "Introduce every new card that's due" },
];

export const DEFAULT_NEW_CARDS_LIMIT = 20;

export async function getStudySettings(): Promise<StudySettings> {
  if (isTauriRuntime()) {
    return invoke<StudySettings>("get_study_settings");
  }

  return {
    newCardsLimit: readWebNewCardsLimit(),
    newCardsToday: countWebNewCardsToday(),
  };
}

export async function saveStudySettings(newCardsLimit: number | null): Promise<StudySettings> {
  if (isTauriRuntime()) {
    return invoke<StudySettings>("save_study_settings", { newCardsLimit });
  }

  writeWebNewCardsLimit(newCardsLimit);

  return {
    newCardsLimit,
    newCardsToday: countWebNewCardsToday(),
  };
}

export function computeNewCardsBudget(
  newCardsLimit: number | null,
  newCardsToday: number,
): number | null {
  if (newCardsLimit === null) {
    return null;
  }

  return Math.max(0, newCardsLimit - Math.max(0, newCardsToday));
}

/**
 * Estimate daily review count after 30 days at the given new-cards-per-day
 * rate.  Each new card generates ~7 reviews in the first month at 90 %
 * retention (Wozniak / SuperMemo data).
 */
export function estimateDailyReviewsIn30Days(newCardsPerDay: number): number {
  return Math.round(newCardsPerDay * REVIEW_MULTIPLIER_30D);
}

function readWebNewCardsLimit(): number | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return DEFAULT_NEW_CARDS_LIMIT;
  }

  const raw = window.localStorage.getItem(WEB_STUDY_SETTINGS_KEY);

  if (!raw) {
    return DEFAULT_NEW_CARDS_LIMIT;
  }

  try {
    const parsed = JSON.parse(raw) as { newCardsLimit?: number | null };

    if (parsed.newCardsLimit === null) {
      return null;
    }

    if (typeof parsed.newCardsLimit === "number" && parsed.newCardsLimit > 0) {
      return parsed.newCardsLimit;
    }

    return DEFAULT_NEW_CARDS_LIMIT;
  } catch {
    return DEFAULT_NEW_CARDS_LIMIT;
  }
}

function writeWebNewCardsLimit(newCardsLimit: number | null): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(WEB_STUDY_SETTINGS_KEY, JSON.stringify({ newCardsLimit }));
}

function countWebNewCardsToday(): number {
  if (typeof window === "undefined" || !window.localStorage) {
    return 0;
  }

  const raw = window.localStorage.getItem(WEB_REVIEW_LOG_STORAGE_KEY);

  if (!raw) {
    return 0;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return 0;
    }

    const today = formatDay(Date.now());
    const seenCardIds = new Set<string>();

    for (const entry of parsed) {
      if (
        entry &&
        typeof entry === "object" &&
        typeof (entry as { reviewTime: number }).reviewTime === "number" &&
        typeof (entry as { state: number }).state === "number" &&
        (entry as { state: number }).state === 0 &&
        formatDay((entry as { reviewTime: number }).reviewTime) === today
      ) {
        seenCardIds.add((entry as { cardId: string }).cardId);
      }
    }

    return seenCardIds.size;
  } catch {
    return 0;
  }
}

function formatDay(timestamp: number): string {
  const value = new Date(timestamp);
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
