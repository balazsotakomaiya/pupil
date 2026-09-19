import { describe, expect, it, vi } from "vitest";
import { enableTauriRuntime, invokeMock } from "../test/tauri";
import { getDashboardStats, listSpaceStats } from "./stats";

const NOW = Date.UTC(2026, 6, 17, 12, 0, 0);

function card(overrides: { id: string; due: number }) {
  return {
    id: overrides.id,
    spaceId: "space-a",
    spaceName: "Space A",
    front: "Front",
    back: "Back",
    tags: [],
    source: "manual",
    state: 2,
    due: overrides.due,
    stability: 1,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 1,
    learningSteps: 0,
    reps: 1,
    lapses: 0,
    lastReview: null,
    createdAt: NOW,
    updatedAt: NOW,
    suspended: false,
    hasExplanation: false,
  };
}

function reviewLog(overrides: { reviewTime: number; grade: number }) {
  return {
    id: `log-${overrides.reviewTime}`,
    cardId: "card-a",
    due: overrides.reviewTime,
    elapsedDays: 0,
    grade: overrides.grade,
    reviewTime: overrides.reviewTime,
    scheduledDays: 1,
    spaceId: "space-a",
    spaceName: "Space A",
    state: 2,
  };
}

function seedStatsStorage() {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  window.localStorage.setItem(
    "pupil.web.cards",
    JSON.stringify([
      card({ id: "card-due", due: NOW - 1 }),
      card({ id: "card-later", due: NOW + 1 }),
    ]),
  );
  window.localStorage.setItem(
    "pupil.web.review_logs",
    JSON.stringify([
      reviewLog({ reviewTime: NOW, grade: 3 }),
      reviewLog({ reviewTime: NOW - 24 * 60 * 60 * 1000, grade: 1 }),
    ]),
  );
  window.localStorage.setItem(
    "pupil.web.study_days",
    JSON.stringify([
      { spaceId: null, day: "2026-07-17" },
      { spaceId: null, day: "2026-07-16" },
    ]),
  );
}

describe("stats browser fallback", () => {
  it("derives dashboard counts and streaks from persisted data", async () => {
    seedStatsStorage();
    await expect(getDashboardStats()).resolves.toMatchObject({
      dueToday: 1,
      globalStreak: 2,
      studiedToday: 1,
      totalCards: 2,
    });
  });
  it("derives space retention and activity from persisted data", async () => {
    seedStatsStorage();
    await expect(listSpaceStats()).resolves.toEqual([
      expect.objectContaining({
        retention30d: 50,
        reviewActivity7d: expect.arrayContaining([1]),
        spaceId: "space-a",
      }),
    ]);
  });
  it("recovers from malformed browser storage", async () => {
    window.localStorage.setItem("pupil.web.cards", "not json");
    window.localStorage.setItem("pupil.web.review_logs", "{}");
    await expect(getDashboardStats()).resolves.toMatchObject({
      dueToday: 0,
      globalStreak: 0,
      studiedToday: 0,
      totalCards: 0,
    });
    await expect(listSpaceStats()).resolves.toEqual([]);
  });
});

describe("stats desktop commands", () => {
  it("gets dashboard stats through the Tauri boundary", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce({
      dueToday: 3,
      globalStreak: 4,
      studiedToday: 2,
      studyDays: [],
      totalCards: 9,
    });
    await expect(getDashboardStats()).resolves.toMatchObject({ dueToday: 3, totalCards: 9 });
    expect(invokeMock).toHaveBeenCalledWith("get_dashboard_stats", undefined);
  });
  it("lists space stats through the Tauri boundary", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce([
      { retention30d: 90, reviewActivity7d: [0, 0, 0, 0, 0, 0, 1], spaceId: "space-a" },
    ]);
    await expect(listSpaceStats()).resolves.toMatchObject([{ spaceId: "space-a" }]);
    expect(invokeMock).toHaveBeenCalledWith("list_space_stats", undefined);
  });
});
