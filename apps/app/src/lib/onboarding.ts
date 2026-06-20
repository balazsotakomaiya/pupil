import { readWebString, removeWebKey, writeWebString } from "./web-store";

const ONBOARDING_DISMISSED_STORAGE_KEY = "pupil.onboarding.dismissed";

export function hasDismissedOnboarding(): boolean {
  return readWebString(ONBOARDING_DISMISSED_STORAGE_KEY) === "1";
}

export function dismissOnboarding(): void {
  writeWebString(ONBOARDING_DISMISSED_STORAGE_KEY, "1");
}

export function resetOnboarding(): void {
  removeWebKey(ONBOARDING_DISMISSED_STORAGE_KEY);
}
