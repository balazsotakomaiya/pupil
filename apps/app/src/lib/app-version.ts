import { getVersion } from "@tauri-apps/api/app";
import appPackage from "../../package.json";
import { isTauriRuntime } from "./runtime";

export const APP_VERSION_FALLBACK = appPackage.version;

export function formatAppVersion(version: string): string {
  return `v${version}`;
}

export async function getAppVersion(): Promise<string> {
  if (!isTauriRuntime()) {
    return APP_VERSION_FALLBACK;
  }

  try {
    return await getVersion();
  } catch {
    return APP_VERSION_FALLBACK;
  }
}
