import { describe, expect, it } from "vitest";
import { enableTauriRuntime, invokeMock } from "../test/tauri";
import { listRecentActivity } from "./activity";

const NOW = Date.UTC(2026, 6, 17, 12, 0, 0);

function reviewLog(overrides: {
  cardId?: string;
  reviewTime: number;
  spaceId: string;
  spaceName: string;
}) {
  return {
    id: `log-${overrides.spaceId}-${overrides.reviewTime}`,
    cardId: overrides.cardId ?? `card-${overrides.spaceId}`,
    due: overrides.reviewTime,
    elapsedDays: 0,
    grade: 3,
    reviewTime: overrides.reviewTime,
    scheduledDays: 1,
    spaceId: overrides.spaceId,
    spaceName: overrides.spaceName,
    state: 2,
  };
}

describe("recent activity", () => {
  it("groups nearby reviews in the same space and keeps distinct sessions", async () => {
    window.localStorage.setItem(
      "pupil.web.review_logs",
      JSON.stringify([
        reviewLog({ spaceId: "space-a", spaceName: "A", reviewTime: NOW }),
        reviewLog({ spaceId: "space-a", spaceName: "A", reviewTime: NOW - 60_000 }),
        reviewLog({ spaceId: "space-b", spaceName: "B", reviewTime: NOW - 120_000 }),
        reviewLog({ spaceId: "space-a", spaceName: "A", reviewTime: NOW - 60 * 60 * 1000 }),
      ]),
    );

    await expect(listRecentActivity()).resolves.toEqual([
      expect.objectContaining({ spaceId: "space-a", reviewCount: 2 }),
      expect.objectContaining({ spaceId: "space-b", reviewCount: 1 }),
      expect.objectContaining({ spaceId: "space-a", reviewCount: 1 }),
    ]);
  });

  it("uses the desktop command in Tauri mode", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce([
      { id: "space-a:1", reviewCount: 1, reviewTime: 1, spaceId: "space-a", spaceName: "A" },
    ]);

    await expect(listRecentActivity()).resolves.toMatchObject([{ spaceId: "space-a" }]);
    expect(invokeMock).toHaveBeenCalledWith("list_recent_activity", undefined);
  });
});
