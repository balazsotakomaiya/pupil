import { describe, expect, it } from "vitest";
import { enableTauriRuntime, invokeMock } from "../test/tauri";
import { listRecentActivity } from "./activity";

const NOW = Date.UTC(2026, 6, 17, 12, 0, 0);

describe("recent activity", () => {
  it("groups nearby reviews in the same space and keeps distinct sessions", async () => {
    window.localStorage.setItem(
      "pupil.web.review_logs",
      JSON.stringify([
        { spaceId: "space-a", spaceName: "A", reviewTime: NOW },
        { spaceId: "space-a", spaceName: "A", reviewTime: NOW - 60_000 },
        { spaceId: "space-b", spaceName: "B", reviewTime: NOW - 120_000 },
        { spaceId: "space-a", spaceName: "A", reviewTime: NOW - 60 * 60 * 1000 },
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
