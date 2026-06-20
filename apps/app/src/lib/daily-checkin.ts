import { formatDayKey, readWebString, writeWebString } from "./web-store";

const DAILY_CHECKIN_DISMISSAL_KEY = "pupil.app.daily-checkin-dismissed-day";

export function dismissDailyCheckIn(dayKey = getTodayDayKey()): string {
  writeWebString(DAILY_CHECKIN_DISMISSAL_KEY, dayKey);
  return dayKey;
}

export function getDismissedDailyCheckInDay(): string | null {
  return readWebString(DAILY_CHECKIN_DISMISSAL_KEY);
}

export function getTodayDayKey(now = Date.now()): string {
  return formatDayKey(now);
}
