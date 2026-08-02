import type { PupilStorage } from "@pupil/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStorage, getStorage, setStorage } from "./index";

afterEach(() => {
  setStorage(null);
  vi.unstubAllGlobals();
});

describe("storage selection", () => {
  it("falls back to web storage outside the Tauri shell", async () => {
    vi.stubGlobal("window", { localStorage: undefined });

    // The web implementation degrades to empty results without local storage,
    // whereas the Tauri implementation would attempt an IPC call and throw.
    await expect(createStorage().listSpaces()).resolves.toEqual([]);
  });

  it("reuses one instance across calls", () => {
    expect(getStorage()).toBe(getStorage());
  });

  it("uses an injected implementation, which is how other surfaces plug in", async () => {
    const injected = {
      listSpaces: async () => [
        {
          cardCount: 3,
          createdAt: 1,
          dueTodayCount: 2,
          id: "injected",
          name: "From another backend",
          streak: 4,
          updatedAt: 1,
        },
      ],
    } as PupilStorage;

    setStorage(injected);

    expect(getStorage()).toBe(injected);
    expect((await getStorage().listSpaces())[0].id).toBe("injected");
  });
});
