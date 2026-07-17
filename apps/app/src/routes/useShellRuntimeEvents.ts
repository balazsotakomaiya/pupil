import { useEffect } from "react";
import { toAppError } from "../lib/errors";
import { log } from "../lib/log";
import { notifyError } from "../lib/notifications";
import { isTauriRuntime } from "../lib/runtime";

type ShellRuntimeEventsInput = {
  onResetOnboarding: () => void;
  onStartStudy: () => void;
  onToggleCommandPalette: () => void;
};

export function useShellRuntimeEvents({
  onResetOnboarding,
  onStartStudy,
  onToggleCommandPalette,
}: ShellRuntimeEventsInput) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onToggleCommandPalette();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggleCommandPalette]);

  useEffect(() => {
    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const error = toAppError(event.reason, "Unhandled async failure.");
      log.error("Unhandled promise rejection", {
        code: error.code,
        message: error.message,
        severity: error.severity,
      });
      notifyError(error, "Unexpected async failure");
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let disposeReset: (() => void) | undefined;
    let disposeStudy: (() => void) | undefined;
    let isDisposed = false;

    void import("@tauri-apps/api/event").then(({ listen }) => {
      void listen("developer://reset-onboarding", onResetOnboarding).then((dispose) => {
        if (isDisposed) {
          dispose();
        } else {
          disposeReset = dispose;
        }
      });

      void listen("tray://study-now", onStartStudy).then((dispose) => {
        if (isDisposed) {
          dispose();
        } else {
          disposeStudy = dispose;
        }
      });
    });

    return () => {
      isDisposed = true;
      disposeReset?.();
      disposeStudy?.();
    };
  }, [onResetOnboarding, onStartStudy]);
}
