import { describe, expect, it } from "vitest";
import { dayKeyAtOffset, formatDayKey } from "./date";

describe("formatDayKey", () => {
  it("zero-pads month and day", () => {
    expect(formatDayKey(new Date(2026, 0, 5, 13, 30).getTime())).toBe("2026-01-05");
  });

  it("uses the local calendar day rather than UTC", () => {
    const localNoon = new Date(2026, 3, 19, 12, 0, 0);

    expect(formatDayKey(localNoon.getTime())).toBe("2026-04-19");
  });

  it("keeps the same key across a whole local day", () => {
    const startOfDay = new Date(2026, 3, 19, 0, 0, 0).getTime();
    const endOfDay = new Date(2026, 3, 19, 23, 59, 59).getTime();

    expect(formatDayKey(startOfDay)).toBe(formatDayKey(endOfDay));
  });
});

describe("dayKeyAtOffset", () => {
  it("returns today at offset zero", () => {
    const now = new Date(2026, 3, 19, 8, 0, 0).getTime();

    expect(dayKeyAtOffset(0, now)).toBe("2026-04-19");
  });

  it("walks backwards across a month boundary", () => {
    const now = new Date(2026, 3, 1, 8, 0, 0).getTime();

    expect(dayKeyAtOffset(1, now)).toBe("2026-03-31");
    expect(dayKeyAtOffset(2, now)).toBe("2026-03-30");
  });
});
