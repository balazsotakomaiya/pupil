import { describe, expect, it } from "vitest";
import type { CardRecord } from "./cards";
import {
  type CardFsrsFields,
  createNewCardFsrsFields,
  previewCardScheduling,
  scheduleCard,
} from "./fsrs";

function createCard(overrides: Partial<CardRecord> = {}): CardRecord {
  const now = Date.UTC(2026, 3, 19, 10, 0, 0);
  const fsrsFields: CardFsrsFields = createNewCardFsrsFields(now);

  return {
    id: "card-1",
    spaceId: "space-1",
    spaceName: "Rust",
    front: "front",
    back: "back",
    tags: [],
    source: "manual",
    createdAt: now,
    updatedAt: now,
    suspended: false,
    ...fsrsFields,
    ...overrides,
  };
}

describe("previewCardScheduling", () => {
  it("returns one preview per review grade in ascending order", () => {
    const reviewedAt = Date.UTC(2026, 3, 19, 10, 0, 0);
    const previews = previewCardScheduling(createCard(), reviewedAt);

    expect(previews).toHaveLength(4);
    expect(previews.map((preview) => preview.grade)).toEqual([1, 2, 3, 4]);
    expect(previews.map((preview) => preview.updatedCard.lastReview)).toEqual([
      reviewedAt,
      reviewedAt,
      reviewedAt,
      reviewedAt,
    ]);
    expect(previews.map((preview) => preview.updatedCard.due)).toEqual(
      [...previews.map((preview) => preview.updatedCard.due)].sort((left, right) => left - right),
    );
    expect(previews.every((preview) => preview.intervalLabel.length > 0)).toBe(true);
  });
});

describe("scheduleCard", () => {
  it("persists the reviewed timestamp into the FSRS state and log", () => {
    const reviewedAt = Date.UTC(2026, 3, 19, 10, 0, 0);
    const result = scheduleCard(createCard(), 3, reviewedAt);

    expect(result.updatedCard.lastReview).toBe(reviewedAt);
    expect(result.reviewLog.reviewTime).toBe(reviewedAt);
    expect(result.updatedCard.due).toBeGreaterThanOrEqual(reviewedAt);
    expect(result.updatedCard.reps).toBeGreaterThan(0);
  });
});
