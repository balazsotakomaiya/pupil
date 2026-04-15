import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./runtime";

export type SettingsDataSummary = {
  databasePath: string;
  reviewLogCount: number;
};

export type ExportDataResult = {
  path: string;
  recordCount: number;
};

const WEB_KEYS = [
  "pupil.ai.settings",
  "pupil.web.cards",
  "pupil.web.review_logs",
  "pupil.web.spaces",
  "pupil.web.study_days",
  "pupil.web.study_settings",
];

export async function getSettingsDataSummary(): Promise<SettingsDataSummary> {
  if (isTauriRuntime()) {
    return invoke<SettingsDataSummary>("get_settings_data_summary");
  }

  return {
    databasePath: "Browser preview uses localStorage",
    reviewLogCount: readStoredArray("pupil.web.review_logs").length,
  };
}

export async function exportDatabaseCopy(): Promise<ExportDataResult> {
  if (isTauriRuntime()) {
    return invoke<ExportDataResult>("export_database_copy");
  }

  downloadBlob(
    `pupil-export-${Date.now()}.json`,
    JSON.stringify(
      Object.fromEntries(WEB_KEYS.map((key) => [key, window.localStorage.getItem(key)])),
      null,
      2,
    ),
    "application/json",
  );

  return {
    path: "Downloaded in browser",
    recordCount: 1,
  };
}

export async function exportReviewLogsCsv(): Promise<ExportDataResult> {
  if (isTauriRuntime()) {
    return invoke<ExportDataResult>("export_review_logs_csv");
  }

  const logs = readStoredArray("pupil.web.review_logs");
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
    await invoke("reset_all_data");
    return;
  }

  for (const key of WEB_KEYS) {
    window.localStorage.removeItem(key);
  }
}

function readStoredArray(key: string): Array<Record<string, unknown>> {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  const raw = window.localStorage.getItem(key);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
  } catch {
    return [];
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
