import { describe, expect, it } from "vitest";
import {
  type AppUpdateSnapshot,
  getUpdateActionLabel,
  getUpdateHint,
  getUpdatePromptLabel,
  isUpdateBusy,
} from "./app-update";

function snapshot(overrides: Partial<AppUpdateSnapshot> = {}): AppUpdateSnapshot {
  return {
    currentVersion: "1.0.0-alpha.9",
    errorMessage: null,
    notes: "Faster study startup.",
    phase: "idle",
    progress: 0,
    version: null,
    ...overrides,
  };
}

describe("app update copy", () => {
  it("keeps checking, downloading, and restarting as busy states", () => {
    expect(isUpdateBusy("checking")).toBe(true);
    expect(isUpdateBusy("downloading")).toBe(true);
    expect(isUpdateBusy("restarting")).toBe(true);
    expect(isUpdateBusy("available")).toBe(false);
  });

  it("replaces the Settings button and only shows a header button when an update is known", () => {
    expect(getUpdateActionLabel(snapshot())).toBe("Check for updates");
    expect(getUpdatePromptLabel(snapshot())).toBeNull();
    expect(getUpdateHint(snapshot())).toBeNull();

    const available = snapshot({ phase: "available", version: "1.0.0" });
    expect(getUpdateActionLabel(available)).toBe("Restart and update");
    expect(getUpdatePromptLabel(available)).toBe("Update");
    expect(getUpdateHint(available)).toContain("restart");

    expect(getUpdatePromptLabel(snapshot({ phase: "downloading" }))).toBe("Updating…");
    expect(getUpdateActionLabel(snapshot({ phase: "downloading", progress: 0.5 }))).toBe(
      "Downloading 50%",
    );
  });
});
