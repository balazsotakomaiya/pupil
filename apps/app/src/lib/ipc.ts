import { invoke } from "@tauri-apps/api/core";
import { isReportable, toAppError } from "./errors";
import { log } from "./log";
import { isTauriRuntime } from "./runtime";

export async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isTauriRuntime()) {
    throw new Error(`IPC command "${command}" requires the Tauri runtime.`);
  }

  try {
    return await invoke<T>(command, args);
  } catch (error: unknown) {
    const mapped = toAppError(error, `Command "${command}" failed.`);

    if (isReportable(mapped)) {
      log.error("IPC command failed", {
        command,
        ...mapped.toReport(),
      });
    } else {
      log.warn("IPC command failed", { code: mapped.code, command, message: mapped.message });
    }

    throw mapped;
  }
}
