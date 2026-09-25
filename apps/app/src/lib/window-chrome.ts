import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriRuntime } from "./runtime";

/**
 * Title bars mark themselves with `data-window-drag`. Pressing anywhere inside
 * one moves the window, unless the press lands on something interactive.
 * WKWebView ignores `-webkit-app-region`, so the desktop shell has to start
 * the drag itself.
 */
export const WINDOW_DRAG_ATTRIBUTE = "data-window-drag";

const INTERACTIVE_SELECTOR = [
  "a",
  "button",
  "input",
  "label",
  "select",
  "summary",
  "textarea",
  "[contenteditable='true']",
  "[role='button']",
  "[role='menu']",
  "[role='menuitem']",
  "[role='tab']",
  `[${WINDOW_DRAG_ATTRIBUTE}='false']`,
].join(", ");

export type DesktopPlatform = "macos" | "windows" | "linux" | "unknown";

export function detectPlatform(userAgent = navigator.userAgent): DesktopPlatform {
  if (/Mac OS X|Macintosh/.test(userAgent)) {
    return "macos";
  }
  if (/Windows/.test(userAgent)) {
    return "windows";
  }
  if (/Linux|X11/.test(userAgent)) {
    return "linux";
  }
  return "unknown";
}

export function isWindowDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  const region = target.closest(`[${WINDOW_DRAG_ATTRIBUTE}]`);
  if (!region || region.getAttribute(WINDOW_DRAG_ATTRIBUTE) === "false") {
    return false;
  }

  const interactive = target.closest(INTERACTIVE_SELECTOR);
  return !interactive || !region.contains(interactive);
}

/**
 * Exposes the platform on `<html>` and, in the desktop shell, makes title
 * bars draggable. On macOS the window uses an overlay title bar, so the
 * traffic lights sit inside our own bar; `data-fullscreen` lets CSS drop the
 * space reserved for them when they are hidden.
 */
export function installWindowChrome(): void {
  if (typeof document === "undefined") {
    return;
  }

  const platform = detectPlatform();
  document.documentElement.dataset.platform = platform;

  if (!isTauriRuntime()) {
    return;
  }

  const appWindow = getCurrentWindow();

  document.addEventListener("mousedown", (event) => {
    if (event.button !== 0 || !isWindowDragTarget(event.target)) {
      return;
    }

    event.preventDefault();
    if (event.detail === 2) {
      void appWindow.toggleMaximize();
    } else if (event.detail === 1) {
      void appWindow.startDragging();
    }
  });

  if (platform !== "macos") {
    return;
  }

  const syncFullscreen = () => {
    void appWindow.isFullscreen().then((fullscreen) => {
      if (fullscreen) {
        document.documentElement.dataset.fullscreen = "";
      } else {
        delete document.documentElement.dataset.fullscreen;
      }
    });
  };

  syncFullscreen();
  void appWindow.onResized(syncFullscreen);
}
