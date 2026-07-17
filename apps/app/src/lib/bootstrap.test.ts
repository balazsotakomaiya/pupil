import { describe, expect, it } from "vitest";
import { enableTauriRuntime, invokeMock } from "../test/tauri";
import { loadBootstrapState } from "./bootstrap";
import { refreshTrayStatus } from "./tray";

describe("bootstrap and tray boundaries", () => {
  it("returns the browser bootstrap state", async () => {
    await expect(loadBootstrapState()).resolves.toMatchObject({
      appliedMigrations: [],
      mode: "web",
      pendingMigrations: ["0001_init"],
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });
  it("skips tray refresh in the browser", async () => {
    await expect(refreshTrayStatus()).resolves.toBeUndefined();
    expect(invokeMock).not.toHaveBeenCalled();
  });
  it("maps native bootstrap state", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce({
      appDataDir: "/data",
      databasePath: "/data/pupil.sqlite",
      appliedMigrations: ["0001_init"],
      pendingMigrations: [],
      backupCreated: false,
    });
    await expect(loadBootstrapState()).resolves.toMatchObject({
      mode: "tauri",
      appDataDir: "/data",
    });
    expect(invokeMock).toHaveBeenCalledWith("get_bootstrap_state", undefined);
  });
  it("treats a native tray refresh failure as non-fatal", async () => {
    enableTauriRuntime();
    invokeMock.mockRejectedValueOnce(new Error("tray unavailable"));
    await expect(refreshTrayStatus()).resolves.toBeUndefined();
    expect(invokeMock).toHaveBeenCalledWith("refresh_tray_status", undefined);
  });
});
