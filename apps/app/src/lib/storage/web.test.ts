import type { PupilStorage } from "@pupil/core";
import { beforeEach, describe, expect, it } from "vitest";
import { createWebStorage } from "./web";

async function seedSpaceWithCard(storage: PupilStorage, spaceName = "Rust") {
  const space = await storage.createSpace({ name: spaceName });
  const card = await storage.createCard({
    back: "A systems language",
    front: "What is Rust?",
    spaceId: space.id,
    tags: ["lang"],
  });

  return { card, space };
}

let storage: PupilStorage;

beforeEach(() => {
  window.localStorage.clear();
  storage = createWebStorage();
});

describe("spaces", () => {
  it("creates a space and reports card counts", async () => {
    const { space } = await seedSpaceWithCard(storage);
    const spaces = await storage.listSpaces();

    expect(spaces).toHaveLength(1);
    expect(spaces[0].id).toBe(space.id);
    expect(spaces[0].cardCount).toBe(1);
    expect(spaces[0].dueTodayCount).toBe(1);
  });

  it("rejects duplicate names case-insensitively", async () => {
    await storage.createSpace({ name: "Rust" });

    await expect(storage.createSpace({ name: "rust" })).rejects.toThrow(
      "A space with that name already exists.",
    );
  });

  it("rejects a blank name", async () => {
    await expect(storage.createSpace({ name: "   " })).rejects.toThrow(
      "Space name can't be empty.",
    );
  });

  it("propagates a rename to cards and review history", async () => {
    const { card, space } = await seedSpaceWithCard(storage);
    await storage.reviewCard({ card, grade: 3 });

    await storage.renameSpace({ id: space.id, name: "Rust Fundamentals" });

    const [renamedCard] = await storage.listCards();
    const activity = await storage.listRecentActivity();

    expect(renamedCard.spaceName).toBe("Rust Fundamentals");
    expect(activity[0].spaceName).toBe("Rust Fundamentals");
  });

  it("deletes a space along with its cards", async () => {
    const { space } = await seedSpaceWithCard(storage);

    await storage.deleteSpace({ id: space.id });

    expect(await storage.listSpaces()).toEqual([]);
    expect(await storage.listCards()).toEqual([]);
  });
});

describe("cards", () => {
  it("filters by space", async () => {
    const { space } = await seedSpaceWithCard(storage);
    const other = await storage.createSpace({ name: "Go" });
    await storage.createCard({ back: "b", front: "f", spaceId: other.id, tags: [] });

    expect(await storage.listCards({ spaceId: space.id })).toHaveLength(1);
    expect(await storage.listCards()).toHaveLength(2);
  });

  it("trims content and rejects empty fields", async () => {
    const { space } = await seedSpaceWithCard(storage);
    const card = await storage.createCard({
      back: "  back  ",
      front: "  front  ",
      spaceId: space.id,
      tags: [" tag ", "tag"],
    });

    expect(card.front).toBe("front");
    expect(card.back).toBe("back");
    expect(card.tags).toEqual(["tag"]);

    await expect(
      storage.createCard({ back: "b", front: "  ", spaceId: space.id, tags: [] }),
    ).rejects.toThrow("Front can't be empty.");
  });

  it("suspends and deletes", async () => {
    const { card } = await seedSpaceWithCard(storage);

    const suspended = await storage.suspendCard({ id: card.id, suspended: true });
    expect(suspended.suspended).toBe(true);

    await storage.deleteCard({ id: card.id });
    expect(await storage.listCards()).toEqual([]);
  });

  it("reports a missing card rather than failing silently", async () => {
    await expect(storage.deleteCard({ id: "nope" })).rejects.toThrow("Card not found.");
  });
});

describe("reviewing", () => {
  it("advances scheduling, logs the review, and records the study day", async () => {
    const { card } = await seedSpaceWithCard(storage);

    const reviewed = await storage.reviewCard({ card, grade: 3 });

    expect(reviewed.reps).toBe(1);
    expect(reviewed.due).toBeGreaterThan(card.due);

    const stats = await storage.getDashboardStats();
    expect(stats.studiedToday).toBe(1);
    expect(stats.globalStreak).toBe(1);
    expect(stats.totalCards).toBe(1);
  });

  it("restores the previous state on undo", async () => {
    const { card } = await seedSpaceWithCard(storage);
    await storage.reviewCard({ card, grade: 3 });

    const restored = await storage.undoReviewCard({ snapshot: card });

    expect(restored.reps).toBe(card.reps);
    expect(restored.due).toBe(card.due);
    expect(await storage.listRecentActivity()).toEqual([]);
  });

  it("groups reviews into one activity session per space", async () => {
    const { card, space } = await seedSpaceWithCard(storage);
    const second = await storage.createCard({
      back: "b",
      front: "f2",
      spaceId: space.id,
      tags: [],
    });

    await storage.reviewCard({ card, grade: 3 });
    await storage.reviewCard({ card: second, grade: 3 });

    const activity = await storage.listRecentActivity();

    expect(activity).toHaveLength(1);
    expect(activity[0].reviewCount).toBe(2);
  });
});

describe("study settings and queue", () => {
  it("round-trips the new-cards limit", async () => {
    const saved = await storage.saveStudySettings(5);
    expect(saved.newCardsLimit).toBe(5);

    expect((await storage.getStudySettings()).newCardsLimit).toBe(5);

    expect((await storage.saveStudySettings(null)).newCardsLimit).toBeNull();
    expect((await storage.getStudySettings()).newCardsLimit).toBeNull();
  });

  it("gates new cards beyond the daily limit", async () => {
    const { space } = await seedSpaceWithCard(storage);
    await storage.createCard({ back: "b", front: "f2", spaceId: space.id, tags: [] });
    await storage.createCard({ back: "b", front: "f3", spaceId: space.id, tags: [] });
    await storage.saveStudySettings(2);

    const snapshot = await storage.getStudyQueueSnapshot();

    expect(snapshot.actionableDueCount).toBe(2);
    expect(snapshot.gatedNewCount).toBe(1);
    expect(snapshot.actionableDueBySpace).toEqual([{ dueCount: 2, spaceId: space.id }]);
  });

  it("excludes suspended cards from the queue", async () => {
    const { card } = await seedSpaceWithCard(storage);
    await storage.suspendCard({ id: card.id, suspended: true });

    expect((await storage.getStudyQueueSnapshot()).actionableDueCount).toBe(0);
  });
});
