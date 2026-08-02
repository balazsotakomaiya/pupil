import { describe, expect, it } from "vitest";
import { computeNewCardsBudget, estimateDailyReviewsIn30Days } from "./study-settings";

describe("computeNewCardsBudget", () => {
  it("returns null when the daily new-card limit is disabled", () => {
    expect(computeNewCardsBudget(null, 12)).toBeNull();
  });

  it("subtracts cards already introduced today", () => {
    expect(computeNewCardsBudget(20, 6)).toBe(14);
  });

  it("clamps negative or exhausted budgets to zero", () => {
    expect(computeNewCardsBudget(20, 25)).toBe(0);
    expect(computeNewCardsBudget(20, -4)).toBe(20);
  });
});

describe("estimateDailyReviewsIn30Days", () => {
  it("uses the 30-day review multiplier", () => {
    expect(estimateDailyReviewsIn30Days(10)).toBe(70);
    expect(estimateDailyReviewsIn30Days(0)).toBe(0);
  });
});
