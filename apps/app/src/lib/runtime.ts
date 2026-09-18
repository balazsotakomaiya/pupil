declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__ !== "undefined";
}

/** Exposes the active shell on `<html>` for runtime-scoped CSS (e.g. web-only pointer cursors). */
export function applyRuntimeMarker(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.runtime = isTauriRuntime() ? "tauri" : "web";
}
