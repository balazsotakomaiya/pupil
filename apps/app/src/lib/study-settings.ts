import type { StudySettings } from "@pupil/core";
import { getStorage } from "./storage";

export type { StudySettings } from "@pupil/core";
export {
  computeNewCardsBudget,
  DEFAULT_NEW_CARDS_LIMIT,
  estimateDailyReviewsIn30Days,
  NEW_CARDS_PRESETS,
  type NewCardsPreset,
} from "@pupil/core";

export function getStudySettings(): Promise<StudySettings> {
  return getStorage().getStudySettings();
}

export function saveStudySettings(newCardsLimit: number | null): Promise<StudySettings> {
  return getStorage().saveStudySettings(newCardsLimit);
}
