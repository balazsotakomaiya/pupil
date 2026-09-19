import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import type { AppUpdateClient } from "./app-update";

export function createTauriAppUpdateClient(): AppUpdateClient {
  let pending: Update | null = null;

  return {
    async check(currentVersion) {
      const update = await check();
      pending = update;

      if (!update) {
        return null;
      }

      return {
        currentVersion: update.currentVersion || currentVersion,
        notes: update.body ?? "",
        version: update.version,
      };
    },
    async download(onProgress) {
      const update = pending;
      if (!update) {
        throw new Error("No update is ready to install.");
      }

      let downloaded = 0;
      let contentLength = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          contentLength = event.data.contentLength ?? 0;
          onProgress(0);
          return;
        }

        if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          onProgress(contentLength > 0 ? downloaded / contentLength : 0);
          return;
        }

        onProgress(1);
      });
    },
    async relaunch() {
      await relaunch();
    },
  };
}
