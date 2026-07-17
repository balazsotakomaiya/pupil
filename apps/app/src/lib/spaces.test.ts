import { describe, expect, it, vi } from "vitest";
import { enableTauriRuntime, invokeMock } from "../test/tauri";
import { createCard, listCards } from "./cards";
import { createSpace, deleteSpace, listSpaces, renameSpace, type SpaceSummary } from "./spaces";

const NOW = Date.UTC(2026, 6, 17, 10, 0, 0);
function space(overrides: Partial<SpaceSummary> = {}): SpaceSummary {
  return {
    id: "space-a",
    name: "Space A",
    cardCount: 0,
    dueTodayCount: 0,
    streak: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("space desktop commands", () => {
  it("lists spaces through the native boundary", async () => {
    enableTauriRuntime();
    const stored = space();
    invokeMock.mockResolvedValueOnce([stored]);
    await expect(listSpaces()).resolves.toEqual([stored]);
    expect(invokeMock).toHaveBeenCalledWith("list_spaces", undefined);
  });
  it("creates a space through the native boundary", async () => {
    enableTauriRuntime();
    const stored = space();
    invokeMock.mockResolvedValueOnce(stored);
    await expect(createSpace({ name: "Space A" })).resolves.toEqual(stored);
    expect(invokeMock).toHaveBeenCalledWith("create_space", { name: "Space A" });
  });
  it("renames a space through the native boundary", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce(space({ name: "Renamed" }));
    await expect(renameSpace({ id: "space-a", name: "Renamed" })).resolves.toMatchObject({
      name: "Renamed",
    });
    expect(invokeMock).toHaveBeenCalledWith("rename_space", { id: "space-a", name: "Renamed" });
  });
  it("deletes a space through the native boundary", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce(undefined);
    await expect(deleteSpace({ id: "space-a" })).resolves.toBeUndefined();
    expect(invokeMock).toHaveBeenCalledWith("delete_space", { id: "space-a" });
  });
  it("propagates a native duplicate-space error", async () => {
    enableTauriRuntime();
    invokeMock.mockRejectedValueOnce({ code: "DUPLICATE", entity: "space" });
    await expect(createSpace({ name: "Space A" })).rejects.toMatchObject({
      code: "DUPLICATE",
      message: "space already exists",
    });
  });
});

describe("space browser fallback", () => {
  it("normalizes a persisted space name", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    await expect(createSpace({ name: " Rust " })).resolves.toMatchObject({ name: "Rust" });
  });
  it("reports card and due counts for a persisted space", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const created = await createSpace({ name: "Rust" });
    await createCard({ spaceId: created.id, front: "Question", back: "Answer", tags: [] });
    await expect(listSpaces()).resolves.toEqual([
      expect.objectContaining({ id: created.id, cardCount: 1, dueTodayCount: 1 }),
    ]);
  });
  it("renames cards already stored in a space", async () => {
    const created = await createSpace({ name: "Rust" });
    const storedCard = await createCard({
      spaceId: created.id,
      front: "Question",
      back: "Answer",
      tags: [],
    });
    await renameSpace({ id: created.id, name: "TypeScript" });
    await expect(listCards({ spaceId: created.id })).resolves.toEqual([
      expect.objectContaining({ id: storedCard.id, spaceName: "TypeScript" }),
    ]);
  });
  it("cascades deletion to a persisted space", async () => {
    const created = await createSpace({ name: "Rust" });
    await deleteSpace({ id: created.id });
    await expect(listSpaces()).resolves.toEqual([]);
  });
  it("rejects blank, duplicate, and unknown fallback spaces", async () => {
    await expect(createSpace({ name: " " })).rejects.toThrow("Space name can't be empty.");
    await createSpace({ name: "Rust" });
    await expect(createSpace({ name: "rust" })).rejects.toThrow(
      "A space with that name already exists.",
    );
    await expect(deleteSpace({ id: "missing" })).rejects.toThrow("Space not found.");
  });
});
