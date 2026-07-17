export type AppTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "pupil-theme";

function canUseDocument() {
  return typeof document !== "undefined";
}

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function isAppTheme(value: string | null): value is AppTheme {
  return value === "dark" || value === "light";
}

export function getSavedTheme(): AppTheme {
  if (!canUseStorage()) {
    return "dark";
  }

  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isAppTheme(savedTheme) ? savedTheme : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: AppTheme) {
  if (!canUseDocument()) {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // A private or locked-down browser preview can still use the selected theme for this session.
  }
}

export function applySavedTheme() {
  applyTheme(getSavedTheme());
}
