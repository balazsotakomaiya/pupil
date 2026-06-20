import { invokeCommand } from "./ipc";
import { isTauriRuntime } from "./runtime";
import { readWebArray, readWebString, removeWebKey, WEB_STORAGE_KEYS } from "./web-store";

export type SettingsDataSummary = {
  databasePath: string;
  reviewLogCount: number;
};

export type ExportDataResult = {
  path: string;
  recordCount: number;
};

const WEB_KEYS = [
  WEB_STORAGE_KEYS.aiSettings,
  WEB_STORAGE_KEYS.cards,
  WEB_STORAGE_KEYS.reviewLogs,
  WEB_STORAGE_KEYS.spaces,
  WEB_STORAGE_KEYS.studyDays,
  WEB_STORAGE_KEYS.studySettings,
];

export async function getSettingsDataSummary(): Promise<SettingsDataSummary> {
  if (isTauriRuntime()) {
    return invokeCommand<SettingsDataSummary>("get_settings_data_summary");
  }

  return {
    databasePath: "Browser preview uses localStorage",
    reviewLogCount: readWebArray(WEB_STORAGE_KEYS.reviewLogs).length,
  };
}

export async function exportDatabaseCopy(): Promise<ExportDataResult> {
  if (isTauriRuntime()) {
    return invokeCommand<ExportDataResult>("export_database_copy");
  }

  downloadBlob(
    `pupil-export-${Date.now()}.json`,
    JSON.stringify(Object.fromEntries(WEB_KEYS.map((key) => [key, readWebString(key)])), null, 2),
    "application/json",
  );

  return {
    path: "Downloaded in browser",
    recordCount: 1,
  };
}

export async function exportReviewLogsCsv(): Promise<ExportDataResult> {
  if (isTauriRuntime()) {
    return invokeCommand<ExportDataResult>("export_review_logs_csv");
  }

  const logs = readWebArray(WEB_STORAGE_KEYS.reviewLogs) as Array<Record<string, unknown>>;
  const rows = [
    "review_time,space_id,grade,state,due,elapsed_days,scheduled_days",
    ...logs.map((log) =>
      [
        csvField(String(log.reviewTime ?? "")),
        csvField(String(log.spaceId ?? "")),
        csvField(String(log.grade ?? "")),
        csvField(String(log.state ?? "")),
        csvField(String(log.due ?? "")),
        csvField(String(log.elapsedDays ?? "")),
        csvField(String(log.scheduledDays ?? "")),
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

  for (const key of WEB_KEYS) {
    removeWebKey(key);
  }
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
