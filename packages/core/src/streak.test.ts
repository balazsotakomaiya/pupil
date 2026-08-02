import { describe, expect, it } from "vitest";
import { computeStreak } from "./streak";

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(computeStreak(["2026-04-17", "2026-04-18", "2026-04-19"], "2026-04-19")).toBe(3);
  });

  it("keeps the streak alive when today has not been studied yet", () => {
    expect(computeStreak(["2026-04-17", "2026-04-18"], "2026-04-19")).toBe(2);
  });

  it("stops at the first gap before today", () => {
    expect(computeStreak(["2026-04-15", "2026-04-18", "2026-04-19"], "2026-04-19")).toBe(2);
  });

  it("returns zero when neither today nor yesterday was studied", () => {
    expect(computeStreak(["2026-04-15"], "2026-04-19")).toBe(0);
    expect(computeStreak([], "2026-04-19")).toBe(0);
  });

  it("counts across a month boundary", () => {
    expect(computeStreak(["2026-03-30", "2026-03-31", "2026-04-01"], "2026-04-01")).toBe(3);
  });
});
