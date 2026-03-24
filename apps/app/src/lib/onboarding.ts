const ONBOARDING_DISMISSED_STORAGE_KEY = "pupil.onboarding.dismissed";

export function hasDismissedOnboarding(): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  return window.localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY) === "1";
}

export function dismissOnboarding(): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(ONBOARDING_DISMISSED_STORAGE_KEY, "1");
}

export function resetOnboarding(): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.removeItem(ONBOARDING_DISMISSED_STORAGE_KEY);
}
