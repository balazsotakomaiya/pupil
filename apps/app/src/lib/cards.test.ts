import { describe, expect, it, vi } from "vitest";
import { enableTauriRuntime, invokeMock } from "../test/tauri";
import {
  type CardRecord,
  createCard,
  deleteCard,
  listCards,
  reviewCard,
  suspendCard,
  undoReviewCard,
  updateCard,
} from "./cards";
import { createNewCardFsrsFields } from "./fsrs";
import { createSpace } from "./spaces";

const NOW = Date.UTC(2026, 6, 17, 10, 0, 0);

function card(overrides: Partial<CardRecord> = {}): CardRecord {
  return {
    id: "card-a",
    spaceId: "space-a",
    spaceName: "Space A",
    front: "Question",
    back: "Answer",
    tags: ["rust"],
    source: "manual",
    createdAt: NOW,
    updatedAt: NOW,
    suspended: false,
    hasExplanation: false,
    ...createNewCardFsrsFields(NOW),
    ...overrides,
  };
}

async function createFallbackCard() {
  const space = await createSpace({ name: "Space A" });
  return createCard({ spaceId: space.id, front: "Question", back: "Answer", tags: ["rust"] });
}

describe("card desktop commands", () => {
  it("lists cards through the native boundary", async () => {
    enableTauriRuntime();
    const stored = card();
    invokeMock.mockResolvedValueOnce([stored]);
    await expect(listCards({ spaceId: "space-a" })).resolves.toEqual([stored]);
    expect(invokeMock).toHaveBeenCalledWith("list_cards", { spaceId: "space-a" });
  });

  it("creates a card through the native boundary", async () => {
    enableTauriRuntime();
    const stored = card();
    invokeMock.mockResolvedValueOnce(stored);
    await expect(
      createCard({ spaceId: "space-a", front: "Question", back: "Answer", tags: ["rust"] }),
    ).resolves.toEqual(stored);
    expect(invokeMock).toHaveBeenCalledWith("create_card", {
      input: { spaceId: "space-a", front: "Question", back: "Answer", tags: ["rust"] },
    });
  });

  it("updates a card through the native boundary", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce(card({ front: "Updated" }));
    await expect(
      updateCard({
        id: "card-a",
        spaceId: "space-a",
        front: "Updated",
        back: "Answer",
        tags: ["rust"],
      }),
    ).resolves.toMatchObject({ front: "Updated" });
    expect(invokeMock).toHaveBeenCalledWith("update_card", {
      input: { id: "card-a", spaceId: "space-a", front: "Updated", back: "Answer", tags: ["rust"] },
    });
  });

  it("suspends a card through the native boundary", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce(card({ suspended: true }));
    await expect(suspendCard({ id: "card-a", suspended: true })).resolves.toMatchObject({
      suspended: true,
    });
    expect(invokeMock).toHaveBeenCalledWith("suspend_card", {
      input: { id: "card-a", suspended: true },
    });
  });

  it("deletes a card through the native boundary", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce(undefined);
    await expect(deleteCard({ id: "card-a" })).resolves.toBeUndefined();
    expect(invokeMock).toHaveBeenCalledWith("delete_card", { id: "card-a" });
  });

  it("sends the scheduled review to the native boundary", async () => {
    enableTauriRuntime();
    const beforeReview = card();
    const reviewed = card({ state: 2, reps: 1, lastReview: NOW });
    invokeMock.mockResolvedValueOnce(reviewed);
    await expect(reviewCard({ card: beforeReview, grade: 3, reviewedAt: NOW })).resolves.toEqual(
      reviewed,
    );
    expect(invokeMock).toHaveBeenCalledWith(
      "review_card",
      expect.objectContaining({
        input: expect.objectContaining({
          grade: 3,
          id: "card-a",
          lastReview: NOW,
          reviewLog: expect.objectContaining({ reviewTime: NOW }),
        }),
      }),
    );
  });

  it("sends an undo snapshot to the native boundary", async () => {
    enableTauriRuntime();
    const beforeReview = card();
    invokeMock.mockResolvedValueOnce(beforeReview);
    await expect(undoReviewCard({ snapshot: beforeReview })).resolves.toEqual(beforeReview);
    expect(invokeMock).toHaveBeenCalledWith(
      "undo_review_card",
      expect.objectContaining({ input: expect.objectContaining({ id: "card-a", state: 0 }) }),
    );
  });

  it("propagates mapped native command errors", async () => {
    enableTauriRuntime();
    invokeMock.mockRejectedValueOnce({ code: "NOT_FOUND", entity: "card" });
    await expect(deleteCard({ id: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "card not found",
    });
  });
});

describe("card browser fallback", () => {
  it("normalizes and persists a created card", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const space = await createSpace({ name: " Space A " });
    await expect(
      createCard({
        spaceId: space.id,
        front: " Question ",
        back: " Answer ",
        tags: [" rust ", "rust", ""],
      }),
    ).resolves.toMatchObject({
      back: "Answer",
      front: "Question",
      hasExplanation: false,
      spaceId: space.id,
      tags: ["rust"],
    });
  });

  it("updates a persisted card", async () => {
    const created = await createFallbackCard();
    await expect(
      updateCard({
        id: created.id,
        spaceId: created.spaceId,
        front: "Updated",
        back: "Updated answer",
        tags: ["new"],
      }),
    ).resolves.toMatchObject({ front: "Updated", tags: ["new"] });
  });

  it("suspends a persisted card", async () => {
    const created = await createFallbackCard();
    await expect(suspendCard({ id: created.id, suspended: true })).resolves.toMatchObject({
      id: created.id,
      suspended: true,
    });
  });

  it("lists persisted cards", async () => {
    const created = await createFallbackCard();
    await expect(listCards({ spaceId: created.spaceId })).resolves.toEqual([
      expect.objectContaining({ id: created.id }),
    ]);
  });

  it("deletes a persisted card", async () => {
    const created = await createFallbackCard();
    await deleteCard({ id: created.id });
    await expect(listCards()).resolves.toEqual([]);
  });

  it("rejects invalid or missing fallback card data", async () => {
    await expect(
      createCard({ spaceId: "missing", front: "Question", back: "Answer", tags: [] }),
    ).rejects.toThrow("Space not found.");
    await expect(deleteCard({ id: "missing" })).rejects.toThrow("Card not found.");
  });

  it("persists a review log and restores the prior card snapshot on undo", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const space = await createSpace({ name: "Review space" });
    const beforeReview = await createCard({
      spaceId: space.id,
      front: "Question",
      back: "Answer",
      tags: [],
    });
    const reviewed = await reviewCard({ card: beforeReview, grade: 3, reviewedAt: NOW + 60_000 });
    expect(reviewed).toMatchObject({ id: beforeReview.id, lastReview: NOW + 60_000, reps: 1 });
    expect(JSON.parse(window.localStorage.getItem("pupil.web.review_logs") ?? "[]")).toHaveLength(
      1,
    );
    await expect(undoReviewCard({ snapshot: beforeReview })).resolves.toMatchObject({
      id: beforeReview.id,
      lastReview: null,
      reps: 0,
    });
    expect(JSON.parse(window.localStorage.getItem("pupil.web.review_logs") ?? "[]")).toEqual([]);
  });

  it("ignores malformed persisted card entries", async () => {
    window.localStorage.setItem("pupil.web.cards", JSON.stringify([{ id: "incomplete" }, null]));
    await expect(listCards()).resolves.toEqual([]);
  });
});
