import { afterEach, describe, expect, it, vi } from "vitest";
import { resetAppUpdateClient, setAppUpdateClient } from "./app-update";
import { resetAppUpdateStore, useAppUpdateStore } from "./app-update-store";

afterEach(() => {
  resetAppUpdateStore();
  resetAppUpdateClient();
});

describe("app update store", () => {
  it("records an available build without a dialog", async () => {
    setAppUpdateClient({
      check: vi.fn(async (currentVersion) => ({
        currentVersion,
        notes: "Notes",
        version: "1.0.0",
      })),
      download: vi.fn(),
      relaunch: vi.fn(),
    });

    await useAppUpdateStore.getState().refresh();

    expect(useAppUpdateStore.getState()).toMatchObject({
      phase: "available",
      version: "1.0.0",
    });
  });

  it("downloads, then relaunches, and leaves the store up to date", async () => {
    const download = vi.fn(async (onProgress: (ratio: number) => void) => {
      onProgress(0.5);
      onProgress(1);
    });
    const relaunch = vi.fn(async () => undefined);
    setAppUpdateClient({
      check: vi.fn(async (currentVersion) => ({
        currentVersion,
        notes: "Notes",
        version: "1.0.0",
      })),
      download,
      relaunch,
    });

    await useAppUpdateStore.getState().refresh();
    await useAppUpdateStore.getState().install();

    expect(download).toHaveBeenCalledOnce();
    expect(relaunch).toHaveBeenCalledOnce();
    expect(useAppUpdateStore.getState()).toMatchObject({
      phase: "upToDate",
      version: null,
    });
  });
});
