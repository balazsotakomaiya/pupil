import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./runtime";

export async function refreshTrayStatus(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  try {
    await invoke("refresh_tray_status");
  } catch {
    // Non-fatal — tray refresh failures should never break the UI
  }
}
