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
  const groups = new Map<string, RecentActivityRecord>();

  for (const log of logs) {
    const bucket = Math.floor(log.reviewTime / 60000);
    const key = `${log.spaceId}:${bucket}`;
    const current = groups.get(key);

    if (current) {
      current.reviewCount += 1;
      current.reviewTime = Math.max(current.reviewTime, log.reviewTime);
      continue;
    }

    groups.set(key, {
      id: key,
      reviewCount: 1,
      reviewTime: log.reviewTime,
      spaceId: log.spaceId,
      spaceName: log.spaceName ?? "Space",
    });
  }

  return Array.from(groups.values())
    .sort((left, right) => right.reviewTime - left.reviewTime)
    .slice(0, 5);
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
