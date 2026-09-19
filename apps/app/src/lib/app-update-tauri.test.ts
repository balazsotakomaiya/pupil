import type { DownloadEvent } from "@tauri-apps/plugin-updater";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTauriAppUpdateClient } from "./app-update-tauri";

const check = vi.hoisted(() => vi.fn());
const relaunch = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-updater", () => ({
  check,
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch,
}));

beforeEach(() => {
  check.mockReset();
  relaunch.mockReset();
});

describe("tauri app update client", () => {
  it("installs a pending update and relaunches", async () => {
    const downloadAndInstall = vi.fn(async (onEvent: (event: DownloadEvent) => void) => {
      onEvent({ event: "Started", data: { contentLength: 100 } });
      onEvent({ event: "Progress", data: { chunkLength: 50 } });
      onEvent({ event: "Finished" });
    });
    check.mockResolvedValue({
      body: "Notes",
      currentVersion: "1.0.0-alpha.9",
      downloadAndInstall,
      version: "1.0.0",
    });

    const client = createTauriAppUpdateClient();
    const found = await client.check("1.0.0-alpha.9");
    expect(found).toEqual({
      currentVersion: "1.0.0-alpha.9",
      notes: "Notes",
      version: "1.0.0",
    });

    const progress: number[] = [];
    await client.download((ratio) => progress.push(ratio));
    await client.relaunch();

    expect(downloadAndInstall).toHaveBeenCalledOnce();
    expect(progress).toEqual([0, 0.5, 1]);
    expect(relaunch).toHaveBeenCalledOnce();
  });
});
