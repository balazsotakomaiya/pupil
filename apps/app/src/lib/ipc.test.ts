import { describe, expect, it, vi } from "vitest";
import { enableTauriRuntime, invokeMock } from "../test/tauri";
import { ValidationError } from "./errors";
import { invokeCommand } from "./ipc";
import { log } from "./log";

describe("invokeCommand", () => {
  it("rejects outside Tauri before invoking the native boundary", async () => {
    await expect(invokeCommand("list_cards")).rejects.toThrow(
      'IPC command "list_cards" requires the Tauri runtime.',
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("passes a successful command result through unchanged", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce({ id: "card-a" });

    await expect(invokeCommand("get_card", { id: "card-a" })).resolves.toEqual({ id: "card-a" });
    expect(invokeMock).toHaveBeenCalledWith("get_card", { id: "card-a" });
  });

  it("maps structured native errors and logs reportable failures", async () => {
    enableTauriRuntime();
    const logError = vi.spyOn(log, "error").mockImplementation(() => undefined);
    invokeMock.mockRejectedValueOnce({
      code: "STORAGE",
      message: "The local database is unavailable.",
    });

    await expect(invokeCommand("list_cards")).rejects.toMatchObject({
      code: "STORAGE",
      message: "The local database is unavailable.",
    });
    expect(logError).toHaveBeenCalledWith(
      "IPC command failed",
      expect.objectContaining({ code: "STORAGE", command: "list_cards" }),
    );
  });

  it("maps validation failures without reporting them as infrastructure errors", async () => {
    enableTauriRuntime();
    const logWarn = vi.spyOn(log, "warn").mockImplementation(() => undefined);
    invokeMock.mockRejectedValueOnce({
      code: "VALIDATION",
      field: "front",
      message: "Front is required.",
    });

    await expect(invokeCommand("create_card")).rejects.toBeInstanceOf(ValidationError);
    expect(logWarn).toHaveBeenCalledWith(
      "IPC command failed",
      expect.objectContaining({ code: "VALIDATION", command: "create_card" }),
    );
  });
});
