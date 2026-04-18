import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./runtime";

export type RecentActivityRecord = {
  id: string;
  reviewCount: number;
  reviewTime: number;
  spaceId: string;
  spaceName: string;
};

const WEB_REVIEW_LOG_STORAGE_KEY = "pupil.web.review_logs";
const RECENT_ACTIVITY_SESSION_GAP_MS = 30 * 60 * 1000;
const MAX_RECENT_ACTIVITY_ROWS = 5;

type StoredReviewLog = {
  reviewTime: number;
  spaceId: string;
  spaceName?: string;
};

export async function listRecentActivity(): Promise<RecentActivityRecord[]> {
  if (isTauriRuntime()) {
    return invoke<RecentActivityRecord[]>("list_recent_activity");
  }

  const logs = readStoredReviewLogs();
  logs.sort((left, right) => right.reviewTime - left.reviewTime);
  const sessions: RecentActivityRecord[] = [];

  for (const log of logs) {
    const current = sessions.at(-1);
    const belongsToCurrentSession =
      !!current &&
      current.spaceId === log.spaceId &&
      current.reviewTime - log.reviewTime <= RECENT_ACTIVITY_SESSION_GAP_MS;

    if (belongsToCurrentSession && current) {
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
        typeof (value as StoredReviewLog).reviewTime === "number",
    );
  } catch {
    return [];
  }
}
