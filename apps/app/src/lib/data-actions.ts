import { type CardRecord, DEFAULT_NEW_CARDS_LIMIT, type StudyDayRecord } from "@pupil/core";
import { invokeCommand } from "./ipc";
import { isTauriRuntime } from "./runtime";
import { clearWebStorage } from "./storage";
import {
  readCards,
  readNewCardsLimit,
  readReviewLogs,
  readSpaces,
  readStudyDays,
  type StoredReviewLog,
  type StoredSpace,
} from "./storage/web-store";

export type SettingsDataSummary = {
  databasePath: string;
  reviewLogCount: number;
};

export type ExportDataResult = {
  path: string;
  recordCount: number;
};

export type WebCollectionExport = {
  cards: CardRecord[];
  exportedAt: number;
  reviewLogs: StoredReviewLog[];
  spaces: StoredSpace[];
  studyDays: StudyDayRecord[];
  studySettings: { newCardsLimit: number | null };
  version: 1;
};

export async function getSettingsDataSummary(): Promise<SettingsDataSummary> {
  if (isTauriRuntime()) {
    return invokeCommand<SettingsDataSummary>("get_settings_data_summary");
  }

  return {
    databasePath: "Browser preview uses localStorage",
    reviewLogCount: readReviewLogs().length,
  };
}

export function buildWebCollectionExport(now = Date.now()): WebCollectionExport {
  return {
    version: 1,
    exportedAt: now,
    spaces: readSpaces(),
    cards: readCards(),
    reviewLogs: readReviewLogs(),
    studyDays: readStudyDays(),
    studySettings: {
      newCardsLimit: readNewCardsLimit(DEFAULT_NEW_CARDS_LIMIT),
    },
  };
}

export async function exportDatabaseCopy(): Promise<ExportDataResult> {
  if (isTauriRuntime()) {
    return invokeCommand<ExportDataResult>("export_database_copy");
  }

  const payload = buildWebCollectionExport();

  downloadBlob(
    `pupil-export-${payload.exportedAt}.json`,
    JSON.stringify(payload, null, 2),
    "application/json",
  );

  return {
    path: "Downloaded in browser",
    recordCount:
      payload.spaces.length +
      payload.cards.length +
      payload.reviewLogs.length +
      payload.studyDays.length,
  };
}

export async function exportReviewLogsCsv(): Promise<ExportDataResult> {
  if (isTauriRuntime()) {
    return invokeCommand<ExportDataResult>("export_review_logs_csv");
  }

  const logs = readReviewLogs();
  const rows = [
    "review_time,space_id,grade,state,due,elapsed_days,scheduled_days",
    ...logs.map((log) =>
      [
        csvField(String(log.reviewTime)),
        csvField(log.spaceId),
        csvField(String(log.grade)),
        csvField(String(log.state)),
        csvField(String(log.due)),
        csvField(String(log.elapsedDays ?? "")),
        csvField(String(log.scheduledDays)),
      ].join(","),
    ),
  ];

  downloadBlob(`pupil-review-logs-${Date.now()}.csv`, rows.join("\n"), "text/csv;charset=utf-8");

  return {
    path: "Downloaded in browser",
    recordCount: logs.length,
  };
}

export async function resetAllData(): Promise<void> {
  if (isTauriRuntime()) {
    await invokeCommand("reset_all_data");
    return;
  }

  clearWebStorage();
}

function downloadBlob(filename: string, content: string, type: string) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvField(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
