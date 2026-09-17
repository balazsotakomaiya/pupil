import { describe, expect, it } from "vitest";
import { enableTauriRuntime, invokeMock } from "../test/tauri";
import {
  exportDatabaseCopy,
  exportReviewLogsCsv,
  getSettingsDataSummary,
  resetAllData,
} from "./data-actions";

describe("data actions browser fallback", () => {
  it("summarizes persisted review logs", async () => {
    window.localStorage.setItem(
      "pupil.web.review_logs",
      JSON.stringify([{ id: "one" }, { id: "two" }]),
    );
    await expect(getSettingsDataSummary()).resolves.toEqual({
      databasePath: "Browser preview uses localStorage",
      reviewLogCount: 2,
    });
  });
  it("resets every browser data key", async () => {
    window.localStorage.setItem("pupil.web.review_logs", "[]");
    window.localStorage.setItem("pupil.web.cards", "[]");
    window.localStorage.setItem("pupil.ai.settings", "{}");
    window.localStorage.setItem("pupil.web.import-history", "[]");
    await resetAllData();
    expect(window.localStorage.getItem("pupil.web.review_logs")).toBeNull();
    expect(window.localStorage.getItem("pupil.web.cards")).toBeNull();
    expect(window.localStorage.getItem("pupil.ai.settings")).toBeNull();
    expect(window.localStorage.getItem("pupil.web.import-history")).toBeNull();
  });
});

describe("data action desktop commands", () => {
  it("gets the desktop data summary", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce({ databasePath: "/data/pupil.sqlite", reviewLogCount: 2 });
    await expect(getSettingsDataSummary()).resolves.toMatchObject({ reviewLogCount: 2 });
    expect(invokeMock).toHaveBeenCalledWith("get_settings_data_summary", undefined);
  });
  it("exports a desktop database copy", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce({ path: "/downloads/pupil.sqlite", recordCount: 1 });
    await expect(exportDatabaseCopy()).resolves.toMatchObject({ recordCount: 1 });
    expect(invokeMock).toHaveBeenCalledWith("export_database_copy", undefined);
  });
  it("exports desktop review logs as CSV", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce({ path: "/downloads/reviews.csv", recordCount: 2 });
    await expect(exportReviewLogsCsv()).resolves.toMatchObject({ recordCount: 2 });
    expect(invokeMock).toHaveBeenCalledWith("export_review_logs_csv", undefined);
  });
  it("resets desktop data", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce(undefined);
    await expect(resetAllData()).resolves.toBeUndefined();
    expect(invokeMock).toHaveBeenCalledWith("reset_all_data", undefined);
  });
});
