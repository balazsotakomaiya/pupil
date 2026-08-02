export type NewCardsPreset = {
  description: string;
  label: string;
  value: number | null;
  warn?: boolean;
};

/**
 * Average number of reviews a single new card generates within 30 days at
 * ~90 % retention.  Derived from Wozniak's SuperMemo long-term data and
 * confirmed by Anki community benchmarks.
 */
const REVIEW_MULTIPLIER_30D = 7;

export const DEFAULT_NEW_CARDS_LIMIT = 20;

export const NEW_CARDS_PRESETS: NewCardsPreset[] = [
  { label: "Light", value: 10, description: "10 new cards / day" },
  { label: "Moderate", value: 20, description: "20 new cards / day" },
  { label: "Intensive", value: 50, description: "50 new cards / day", warn: true },
  { label: "Heavy", value: 100, description: "100 new cards / day", warn: true },
  { label: "No limit", value: null, description: "Introduce every new card that's due" },
];

export function computeNewCardsBudget(
  newCardsLimit: number | null,
  newCardsToday: number,
): number | null {
  if (newCardsLimit === null) {
    return null;
  }

  return Math.max(0, newCardsLimit - Math.max(0, newCardsToday));
}

/**
 * Estimate daily review count after 30 days at the given new-cards-per-day
 * rate.  Each new card generates ~7 reviews in the first month at 90 %
 * retention (Wozniak / SuperMemo data).
 */
export function estimateDailyReviewsIn30Days(newCardsPerDay: number): number {
  return Math.round(newCardsPerDay * REVIEW_MULTIPLIER_30D);
}
