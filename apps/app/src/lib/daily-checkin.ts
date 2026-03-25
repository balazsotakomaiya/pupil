const DAILY_CHECKIN_DISMISSAL_KEY = "pupil.app.daily-checkin-dismissed-day";

export function dismissDailyCheckIn(dayKey = getTodayDayKey()): string {
  window.localStorage.setItem(DAILY_CHECKIN_DISMISSAL_KEY, dayKey);
  return dayKey;
}

export function getDismissedDailyCheckInDay(): string | null {
  return window.localStorage.getItem(DAILY_CHECKIN_DISMISSAL_KEY);
}

export function getTodayDayKey(now = Date.now()): string {
  const date = new Date(now);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
