import { describe, expect, it, vi } from "vitest";
import { enableTauriRuntime, invokeMock } from "../test/tauri";
import {
  buildWebCollectionExport,
  exportDatabaseCopy,
  exportReviewLogsCsv,
  getSettingsDataSummary,
  resetAllData,
} from "./data-actions";
import { createWebStorage } from "./storage/web";

function storedReviewLog(id: string) {
  return {
    cardId: `card-${id}`,
    due: 1,
    elapsedDays: 0,
    grade: 3,
    id,
    reviewTime: 1,
    scheduledDays: 0,
    spaceId: "space-a",
    state: 2,
  };
}

describe("data actions browser fallback", () => {
  it("summarizes persisted review logs", async () => {
    window.localStorage.setItem(
      "pupil.web.review_logs",
      JSON.stringify([storedReviewLog("one"), storedReviewLog("two")]),
    );
    await expect(getSettingsDataSummary()).resolves.toEqual({
      databasePath: "Browser preview uses localStorage",
      reviewLogCount: 2,
    });
  });
  it("exports parsed collection JSON instead of raw localStorage strings", async () => {
    const storage = createWebStorage();
    const space = await storage.createSpace({ name: "DSA" });
    await storage.createCard({
      back: "world",
      front: "Hello",
      spaceId: space.id,
      tags: [],
    });
    window.localStorage.setItem("pupil.ai.settings", JSON.stringify({ apiKey: "sk-secret" }));

    const payload = buildWebCollectionExport(1_789_772_342_380);
    const serialized = JSON.stringify(payload);

    expect(payload).toEqual({
      version: 1,
      exportedAt: 1_789_772_342_380,
      spaces: [expect.objectContaining({ id: space.id, name: "DSA" })],
      cards: [expect.objectContaining({ back: "world", front: "Hello", spaceId: space.id })],
      reviewLogs: [],
      studyDays: [],
      studySettings: { newCardsLimit: 20 },
    });
    expect(serialized).not.toContain("pupil.web.cards");
    expect(serialized).not.toContain("sk-secret");

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await expect(exportDatabaseCopy()).resolves.toEqual({
      path: "Downloaded in browser",
      recordCount: 2,
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
