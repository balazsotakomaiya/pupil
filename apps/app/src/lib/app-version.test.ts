import { describe, expect, it } from "vitest";
import { APP_VERSION_FALLBACK, formatAppVersion, getAppVersion } from "./app-version";

describe("app version", () => {
  it("formats versions and uses the package version outside Tauri", async () => {
    expect(formatAppVersion("1.2.3")).toBe("v1.2.3");
    await expect(getAppVersion()).resolves.toBe(APP_VERSION_FALLBACK);
  });
});
