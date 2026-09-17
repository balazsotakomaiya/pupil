import { describe, expect, it } from "vitest";
import { disableTauriRuntime, enableTauriRuntime } from "../test/tauri";
import { isTauriRuntime } from "./runtime";

describe("isTauriRuntime", () => {
  it("returns false outside the Tauri shell", () => {
    disableTauriRuntime();

    expect(isTauriRuntime()).toBe(false);
  });

  it("returns true when Tauri internals are available", () => {
    enableTauriRuntime();

    expect(isTauriRuntime()).toBe(true);
  });
});
