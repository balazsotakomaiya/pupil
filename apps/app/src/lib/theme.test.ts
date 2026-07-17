import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyTheme, getSavedTheme, isAppTheme, THEME_STORAGE_KEY } from "./theme";

let storage: Map<string, string>;
let originalWindow: PropertyDescriptor | undefined;
let originalDocument: PropertyDescriptor | undefined;

beforeEach(() => {
  storage = new Map();
  originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

  const documentElement = {
    dataset: {} as Record<string, string>,
    style: {
      colorScheme: "",
      removeProperty(property: string) {
        if (property === "color-scheme") {
          this.colorScheme = "";
        }
      },
    },
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        clear: () => storage.clear(),
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { documentElement },
  });
});

afterEach(() => {
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }

  if (originalDocument) {
    Object.defineProperty(globalThis, "document", originalDocument);
  } else {
    Reflect.deleteProperty(globalThis, "document");
  }
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
