import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./runtime";

type LogContext = Record<string, unknown> | undefined;
type LogLevel = "debug" | "info" | "warn" | "error";

const IS_DEVELOPMENT = import.meta.env.DEV;
// Release builds ship without devtools, so console output is invisible to the
// user reporting a bug. Anything at or above this level is mirrored into the
// backend's rotating log file, where it can actually be retrieved.
const FORWARDED_LEVELS: ReadonlySet<LogLevel> = new Set<LogLevel>(["warn", "error"]);

function serializeContext(context: LogContext): string | undefined {
  if (!context) {
    return undefined;
  }

  try {
    return JSON.stringify(context);
  } catch {
    // Circular or otherwise unserializable context should never cost us the
    // log line itself.
    return "[unserializable context]";
  }
}

function forward(level: LogLevel, message: string, context?: LogContext) {
  if (!FORWARDED_LEVELS.has(level) || !isTauriRuntime()) {
    return;
  }

  // Deliberately not routed through invokeCommand: that helper reports its own
  // failures through this module, which would recurse against a failing backend.
  void invoke("log_frontend_event", {
    input: { level, message, context: serializeContext(context) },
  }).catch(() => {
    // A backend that cannot record the log is not worth a second failure.
  });
}

function write(level: LogLevel, message: string, context?: LogContext) {
  if (level === "debug" && !IS_DEVELOPMENT) {
    return;
  }

  const payload = context ? [message, context] : [message];
  console[level](...payload);
  forward(level, message, context);
}

export const log = {
  debug(message: string, context?: LogContext) {
    write("debug", message, context);
  },
  info(message: string, context?: LogContext) {
    write("info", message, context);
  },
  warn(message: string, context?: LogContext) {
    write("warn", message, context);
  },
  error(message: string, context?: LogContext) {
    write("error", message, context);
  },
};
