import { describe, expect, it } from "vitest";
import { disableTauriRuntime, enableTauriRuntime } from "../test/tauri";
import { applyRuntimeMarker, isTauriRuntime } from "./runtime";

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

describe("applyRuntimeMarker", () => {
  it("marks the document as web outside the Tauri shell", () => {
    disableTauriRuntime();
    applyRuntimeMarker();

    expect(document.documentElement.dataset.runtime).toBe("web");
  });

  it("marks the document as tauri inside the Tauri shell", () => {
    enableTauriRuntime();
    applyRuntimeMarker();

    expect(document.documentElement.dataset.runtime).toBe("tauri");
  });
});
