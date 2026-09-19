import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

if (typeof window !== "undefined" && typeof window.localStorage?.clear !== "function") {
  const store = new Map<string, string>();
  const mockStorage: Storage = {
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: mockStorage,
    writable: true,
  });
}

afterEach(async () => {
  cleanup();
  // Storage selection is cached for the session; clear it between tests so
  // Tauri/web runtime toggles in one file cannot leak into the next.
  const { setStorage } = await import("../lib/storage");
  setStorage(null);
});
