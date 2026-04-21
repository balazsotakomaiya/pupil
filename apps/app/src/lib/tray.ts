import { invokeCommand } from "./ipc";
import { isTauriRuntime } from "./runtime";

export async function refreshTrayStatus(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  try {
    await invokeCommand("refresh_tray_status");
  } catch {
    // Non-fatal — tray refresh failures should never break the UI
  }
}
