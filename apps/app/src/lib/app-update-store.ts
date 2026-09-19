import { create } from "zustand";
import {
  type AppUpdateSnapshot,
  getAppUpdateClient,
  isUpdateBusy,
  readCurrentAppVersion,
} from "./app-update";
import { toAppError } from "./errors";

type AppUpdateStore = AppUpdateSnapshot & {
  install: () => Promise<void>;
  refresh: () => Promise<void>;
};

const INITIAL_SNAPSHOT: AppUpdateSnapshot = {
  currentVersion: null,
  errorMessage: null,
  notes: null,
  phase: "idle",
  progress: 0,
  version: null,
};

export const useAppUpdateStore = create<AppUpdateStore>((set, get) => ({
  ...INITIAL_SNAPSHOT,
  async refresh() {
    if (isUpdateBusy(get().phase)) {
      return;
    }

    set({ errorMessage: null, phase: "checking", progress: 0 });

    try {
      const currentVersion = await readCurrentAppVersion();
      const update = await getAppUpdateClient().check(currentVersion);

      if (!update) {
        set({
          currentVersion,
          errorMessage: null,
          notes: null,
          phase: "upToDate",
          progress: 0,
          version: null,
        });
        return;
      }

      set({
        currentVersion: update.currentVersion,
        errorMessage: null,
        notes: update.notes,
        phase: "available",
        progress: 0,
        version: update.version,
      });
    } catch (error) {
      set({
        errorMessage: toAppError(error, "Couldn't check for updates.").message,
        phase: "error",
        progress: 0,
      });
    }
  },
  async install() {
    if (get().phase !== "available") {
      return;
    }

    set({ errorMessage: null, phase: "downloading", progress: 0 });

    try {
      await getAppUpdateClient().download((ratio) => {
        set({ progress: Math.max(0, Math.min(1, ratio)) });
      });
      set({ phase: "restarting", progress: 1 });
      await getAppUpdateClient().relaunch();
      set({
        errorMessage: null,
        notes: null,
        phase: "upToDate",
        progress: 1,
        version: null,
      });
    } catch (error) {
      set({
        errorMessage: toAppError(error, "Couldn't install the update.").message,
        phase: "error",
        progress: 0,
      });
    }
  },
}));

export function resetAppUpdateStore(): void {
  useAppUpdateStore.setState(INITIAL_SNAPSHOT);
}
