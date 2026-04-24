import { describe, expect, it } from "vitest";
import { buildStudyQueueSnapshot } from "./study-queue";

type QueueCard = {
  createdAt: number;
  due: number;
  id: string;
  spaceId: string;
  state: number;
  suspended: boolean;
  updatedAt: number;
};

function createCard(overrides: Partial<QueueCard> = {}): QueueCard {
  return {
    createdAt: 100,
    due: 100,
    id: "card-1",
    spaceId: "space-a",
    state: 0,
    suspended: false,
    updatedAt: 100,
    ...overrides,
  };
}

describe("buildStudyQueueSnapshot", () => {
  it("matches the shared queue rules for limits, suspension, and overdue reviews", () => {
    const snapshot = buildStudyQueueSnapshot(
      [
        createCard({ id: "review-a", spaceId: "space-a", state: 1 }),
        createCard({ id: "review-b", due: -300000000, spaceId: "space-b", state: 1 }),
        createCard({ createdAt: 300, id: "new-a-1", spaceId: "space-a", updatedAt: 300 }),
        createCard({ createdAt: 200, id: "new-b-1", spaceId: "space-b", updatedAt: 200 }),
        createCard({ createdAt: 100, id: "new-b-2", spaceId: "space-b", updatedAt: 100 }),
        createCard({
          createdAt: 400,
          id: "new-a-suspended",
          spaceId: "space-a",
          suspended: true,
          updatedAt: 400,
        }),
      ],
      1_000,
      2,
    );

    expect(snapshot.actionableDueCount).toBe(4);
    expect(snapshot.gatedNewCount).toBe(1);
    expect(snapshot.overdueReviewCount).toBe(1);
    expect(snapshot.actionableDueBySpace.get("space-a")).toBe(2);
    expect(snapshot.actionableDueBySpace.get("space-b")).toBe(2);
  });

  it("breaks new-card ties deterministically", () => {
    const snapshot = buildStudyQueueSnapshot(
      [
        createCard({ createdAt: 200, id: "a", spaceId: "space-a", updatedAt: 50 }),
        createCard({ createdAt: 300, id: "b", spaceId: "space-b", updatedAt: 50 }),
        createCard({ createdAt: 100, id: "c", spaceId: "space-c", updatedAt: 50 }),
      ],
      1_000,
      2,
    );

    expect(Array.from(snapshot.actionableDueBySpace.entries())).toEqual([
      ["space-b", 1],
      ["space-a", 1],
    ]);
    expect(snapshot.gatedNewCount).toBe(1);
  });
});
