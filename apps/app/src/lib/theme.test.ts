import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme, getSavedTheme, isAppTheme, THEME_STORAGE_KEY } from "./theme";

let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  vi.stubGlobal("document", {
    documentElement: {
      dataset: {},
      style: {
        colorScheme: "",
        removeProperty: (property: string) => {
          if (property === "color-scheme") {
            document.documentElement.style.colorScheme = "";
          }
        },
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("theme", () => {
  it("defaults to dark when there is no saved selection", () => {
    expect(getSavedTheme()).toBe("dark");
  });

  it("accepts only supported theme values", () => {
    expect(isAppTheme("dark")).toBe(true);
    expect(isAppTheme("light")).toBe(true);
    expect(isAppTheme("system")).toBe(false);
  });

  it("applies and persists the selected theme", () => {
    applyTheme("light");

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });
});
