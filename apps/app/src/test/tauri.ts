import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, vi } from "vitest";

type InvokeArgs = [command: string, args?: Record<string, unknown>];

export const invokeMock = vi.fn<(...args: InvokeArgs) => Promise<unknown>>(async () => undefined);

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

let storage = new Map<string, string>();
let originalLocalStorage: PropertyDescriptor | undefined;

function installTestLocalStorage() {
  storage = new Map();
  originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
}

function restoreLocalStorage() {
  if (originalLocalStorage) {
    Object.defineProperty(window, "localStorage", originalLocalStorage);
  } else {
    Reflect.deleteProperty(window, "localStorage");
  }
}

export function enableTauriRuntime() {
  window.__TAURI_INTERNALS__ = {};
}

export function disableTauriRuntime() {
  delete window.__TAURI_INTERNALS__;
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

export function resetTauriTestState() {
  disableTauriRuntime();
  invokeMock.mockReset();
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
}

export async function resetClientStores() {
  const [{ useAppStore }, { useNotificationStore }] = await Promise.all([
    import("../lib/app-store"),
    import("../lib/notifications"),
  ]);
  useAppStore.setState(useAppStore.getInitialState(), true);
  useNotificationStore.setState(useNotificationStore.getInitialState(), true);
}

beforeEach(() => {
  installTestLocalStorage();
});

afterEach(async () => {
  resetTauriTestState();
  await resetClientStores();
  restoreLocalStorage();
});
