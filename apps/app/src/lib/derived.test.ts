import { describe, expect, it } from "vitest";
import { buildActivity, buildStats, buildStreakCells, buildStudySummary } from "./derived";
import type { SpaceSummary } from "./spaces";
import type { DashboardStats } from "./stats";

describe("buildStudySummary", () => {
  it("describes a cleared queue when nothing is due", () => {
    const spaces: SpaceSummary[] = [
      {
        id: "space-1",
        name: "Rust",
        cardCount: 42,
        dueTodayCount: 0,
        streak: 7,
        createdAt: 100,
        updatedAt: 200,
      },
    ];
    const stats: DashboardStats = {
      dueToday: 0,
      globalStreak: 7,
      studiedToday: 3,
      studyDays: ["2026-04-18"],
      totalCards: 42,
    };

    const summary = buildStudySummary(spaces, stats);

    expect(summary.eyebrow).toBe("Queue cleared");
    expect(summary.headline).toBe("No cards due right now");
    expect(summary.primaryActionLabel).toBe("Study all →");
    expect(summary.breakdown).toEqual([{ label: "Rust", value: 42 }]);
  });

  it("summarizes the busiest spaces when reviews are due", () => {
    const spaces: SpaceSummary[] = [
      {
        id: "space-1",
        name: "Rust",
        cardCount: 42,
        dueTodayCount: 8,
        streak: 7,
        createdAt: 100,
        updatedAt: 500,
      },
      {
        id: "space-2",
        name: "History",
        cardCount: 30,
        dueTodayCount: 4,
        streak: 2,
        createdAt: 200,
        updatedAt: 300,
      },
      {
        id: "space-3",
        name: "ML",
        cardCount: 12,
        dueTodayCount: 2,
        streak: 1,
        createdAt: 300,
        updatedAt: 400,
      },
      {
        id: "space-4",
        name: "Music",
        cardCount: 10,
        dueTodayCount: 1,
        streak: 0,
        createdAt: 400,
        updatedAt: 450,
      },
    ];
    const stats: DashboardStats = {
      dueToday: 15,
      globalStreak: 9,
      studiedToday: 5,
      studyDays: ["2026-04-18", "2026-04-19"],
      totalCards: 94,
    };

    const summary = buildStudySummary(spaces, stats);

    expect(summary.headline).toBe("15 cards due today");
    expect(summary.description).toContain("5 already reviewed");
    expect(summary.description).toContain("Most overdue in Rust and History.");
    expect(summary.breakdown).toEqual([
      { label: "Rust", value: 8 },
      { label: "History", value: 4 },
      { label: "ML", value: 2 },
      { label: "other", value: 1 },
    ]);
  });
});

describe("buildStats", () => {
  it("formats key dashboard metrics", () => {
    const stats = buildStats({
      dueToday: 7,
      globalStreak: 14,
      studiedToday: 3,
      studyDays: [],
      totalCards: 1280,
    });

    expect(stats).toEqual([
      { label: "Total cards", value: "1,280", subtext: "Across your full library" },
      { label: "Studied today", value: "3", unit: " / 7", subtext: "due remaining" },
      { label: "Due today", value: "7", subtext: "Reviews ready now" },
      { label: "Global streak", value: "14", unit: "days", subtext: "Across all study sessions" },
    ]);
  });
});

describe("buildActivity", () => {
  it("turns recent activity rows into timeline items", () => {
    const activity = buildActivity(
      [
        {
          id: "activity-1",
          reviewCount: 3,
          reviewTime: Date.UTC(2026, 3, 19, 9, 58, 0),
          spaceId: "space-1",
          spaceName: "Rust",
        },
      ],
      Date.UTC(2026, 3, 19, 10, 0, 0),
    );

    expect(activity).toEqual([
      {
        id: "activity-1",
        timeLabel: "2m ago",
        prefix: "Studied ",
        highlight: "3 cards",
        suffix: " in Rust",
        typeLabel: "study",
      },
    ]);
  });
});

describe("buildStreakCells", () => {
  it("marks supplied study days when real spaces exist", () => {
    const now = new Date("2026-04-19T12:00:00").getTime();
    const cells = buildStreakCells(["2026-04-18", "2026-04-19"], true, now);

    expect(cells).toHaveLength(112);
    expect(cells.at(-1)).toEqual({
      id: "streak-0",
      studied: true,
      today: true,
    });
    expect(cells.at(-2)).toEqual({
      id: "streak-1",
      studied: true,
      today: false,
    });
  });
});
