import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(async () => {
  cleanup();
  // Storage selection is cached for the session; clear it between tests so
  // Tauri/web runtime toggles in one file cannot leak into the next.
  const { setStorage } = await import("../lib/storage");
  setStorage(null);
});
