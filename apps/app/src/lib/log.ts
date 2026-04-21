type LogContext = Record<string, unknown> | undefined;
const IS_DEVELOPMENT = import.meta.env.DEV;

function write(level: "debug" | "info" | "warn" | "error", message: string, context?: LogContext) {
  if (level === "debug" && !IS_DEVELOPMENT) {
    return;
  }

  const payload = context ? [message, context] : [message];
  console[level](...payload);
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
