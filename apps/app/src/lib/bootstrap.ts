import { invokeCommand } from "./ipc";
import { isTauriRuntime } from "./runtime";

export type BootstrapState = {
  appDataDir: string;
  databasePath: string;
  appliedMigrations: string[];
  pendingMigrations: string[];
  backupCreated: boolean;
  mode: "tauri" | "web";
};

export async function loadBootstrapState(): Promise<BootstrapState> {
  if (!isTauriRuntime()) {
    return {
      appDataDir: "Unavailable in web mode",
      databasePath: "Requires the Tauri shell",
      appliedMigrations: [],
      pendingMigrations: ["0001_init"],
      backupCreated: false,
      mode: "web",
    };
  }

  const state = await invokeCommand<Omit<BootstrapState, "mode">>("get_bootstrap_state");

  return {
    ...state,
    mode: "tauri",
  };
}
