import { afterEach, describe, expect, it } from "vitest";
import { disableTauriRuntime } from "../test/tauri";
import { detectPlatform, installWindowChrome, isWindowDragTarget } from "./window-chrome";

const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)";
const WINDOWS_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/120.0";
const LINUX_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko)";

describe("detectPlatform", () => {
  it.each([
    [MAC_UA, "macos"],
    [WINDOWS_UA, "windows"],
    [LINUX_UA, "linux"],
    ["Mozilla/5.0", "unknown"],
  ])("reads %s as %s", (userAgent, platform) => {
    expect(detectPlatform(userAgent)).toBe(platform);
  });
});

describe("isWindowDragTarget", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function renderTitlebar() {
    document.body.innerHTML = `
      <header data-window-drag>
        <span id="logo"><svg id="logo-mark"></svg></span>
        <button id="tab"><svg id="tab-icon"></svg></button>
        <div role="menu"><span id="menu-label"></span></div>
        <span id="opt-out" data-window-drag="false"></span>
      </header>
      <main id="content"></main>
    `;
  }

  function byId(id: string) {
    return document.getElementById(id);
  }

  it("drags from empty and decorative parts of a titlebar", () => {
    renderTitlebar();

    expect(isWindowDragTarget(document.querySelector("header"))).toBe(true);
    expect(isWindowDragTarget(byId("logo-mark"))).toBe(true);
  });

  it("leaves controls inside a titlebar clickable", () => {
    renderTitlebar();

    expect(isWindowDragTarget(byId("tab-icon"))).toBe(false);
    expect(isWindowDragTarget(byId("menu-label"))).toBe(false);
    expect(isWindowDragTarget(byId("opt-out"))).toBe(false);
  });

  it("ignores presses outside any titlebar", () => {
    renderTitlebar();

    expect(isWindowDragTarget(byId("content"))).toBe(false);
    expect(isWindowDragTarget(null)).toBe(false);
  });
});

describe("installWindowChrome", () => {
  it("marks the document with the current platform", () => {
    disableTauriRuntime();
    installWindowChrome();

    expect(document.documentElement.dataset.platform).toBe(detectPlatform());
  });
});
