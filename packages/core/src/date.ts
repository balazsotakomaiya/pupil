/**
 * Day keys are local-time `YYYY-MM-DD` strings. Streaks and "studied today"
 * counts are user-facing calendar concepts, so they intentionally follow the
 * device's local timezone rather than UTC.
 */
export function formatDayKey(timestamp: number): string {
  const value = new Date(timestamp);
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/** Day key for `offset` days before the local day containing `now`. */
export function dayKeyAtOffset(offset: number, now: number): string {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - offset);

  return formatDayKey(day.getTime());
}
