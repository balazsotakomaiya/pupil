import { createTauriAppUpdateClient } from "./app-update-tauri";
import { APP_VERSION_FALLBACK, getAppVersion } from "./app-version";
import { isTauriRuntime } from "./runtime";

export type AppUpdatePhase =
  | "idle"
  | "checking"
  | "upToDate"
  | "available"
  | "downloading"
  | "restarting"
  | "error";

export type AvailableAppUpdate = {
  currentVersion: string;
  notes: string;
  version: string;
};

export type AppUpdateSnapshot = {
  currentVersion: string | null;
  errorMessage: string | null;
  notes: string | null;
  phase: AppUpdatePhase;
  progress: number;
  version: string | null;
};

export type AppUpdateClient = {
  check: (currentVersion: string) => Promise<AvailableAppUpdate | null>;
  download: (onProgress: (ratio: number) => void) => Promise<void>;
  relaunch: () => Promise<void>;
};

export const PROTOTYPE_AVAILABLE_UPDATE = {
  notes: "Faster study startup, and a quieter prompt when a new desktop build is ready.",
  version: "1.0.0",
} as const;

const PROTOTYPE_CHECK_DELAY_MS = 700;
const PROTOTYPE_DOWNLOAD_STEPS = 16;
const PROTOTYPE_DOWNLOAD_STEP_MS = 90;

function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function createPrototypeAppUpdateClient(): AppUpdateClient {
  return {
    async check(currentVersion) {
      await delay(PROTOTYPE_CHECK_DELAY_MS);
      return {
        currentVersion,
        notes: PROTOTYPE_AVAILABLE_UPDATE.notes,
        version: PROTOTYPE_AVAILABLE_UPDATE.version,
      };
    },
    async download(onProgress) {
      for (let step = 1; step <= PROTOTYPE_DOWNLOAD_STEPS; step += 1) {
        await delay(PROTOTYPE_DOWNLOAD_STEP_MS);
        onProgress(step / PROTOTYPE_DOWNLOAD_STEPS);
      }
    },
    async relaunch() {
      await delay(400);
    },
  };
}

export function createDefaultAppUpdateClient(): AppUpdateClient {
  return isTauriRuntime() ? createTauriAppUpdateClient() : createPrototypeAppUpdateClient();
}

let appUpdateClient: AppUpdateClient = createDefaultAppUpdateClient();

export function getAppUpdateClient(): AppUpdateClient {
  return appUpdateClient;
}

export function setAppUpdateClient(client: AppUpdateClient): void {
  appUpdateClient = client;
}

export function resetAppUpdateClient(): void {
  appUpdateClient = createDefaultAppUpdateClient();
}

export async function readCurrentAppVersion(): Promise<string> {
  try {
    return await getAppVersion();
  } catch {
    return APP_VERSION_FALLBACK;
  }
}

export function isUpdateBusy(phase: AppUpdatePhase): boolean {
  return phase === "checking" || phase === "downloading" || phase === "restarting";
}

export function getUpdateHint(snapshot: AppUpdateSnapshot): string | null {
  switch (snapshot.phase) {
    case "available":
      return "Pupil will restart after installing. Cards stay on this device.";
    case "downloading":
      return "Keep the app open until the new build is ready.";
    case "restarting":
      return "The new build is taking over.";
    case "error":
      return snapshot.errorMessage ?? "Nothing was installed. You can try again.";
    default:
      return null;
  }
}

export function getUpdateActionLabel(snapshot: AppUpdateSnapshot): string {
  switch (snapshot.phase) {
    case "checking":
      return "Checking…";
    case "available":
      return "Restart and update";
    case "downloading":
      return snapshot.progress > 0
        ? `Downloading ${Math.round(snapshot.progress * 100)}%`
        : "Downloading…";
    case "restarting":
      return "Restarting…";
    case "error":
      return "Try again";
    default:
      return "Check for updates";
  }
}

export function getUpdatePromptLabel(snapshot: AppUpdateSnapshot): string | null {
  if (snapshot.phase === "available") {
    return "Update";
  }

  if (snapshot.phase === "downloading" || snapshot.phase === "restarting") {
    return "Updating…";
  }

  return null;
}
