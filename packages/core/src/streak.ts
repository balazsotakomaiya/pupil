import { formatDayKey } from "./date";

/**
 * Counts consecutive studied days ending at `today`. A gap on `today` itself
 * does not break the streak — the day is still in progress — but any earlier
 * gap does.
 */
export function computeStreak(days: string[], today: string): number {
  const daySet = new Set(days);
  const cursor = new Date(`${today}T00:00:00`);
  let streak = 0;

  if (!daySet.has(today)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (daySet.has(formatDayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
