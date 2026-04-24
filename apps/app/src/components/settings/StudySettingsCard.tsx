import { useEffect, useState } from "react";
import {
  estimateDailyReviewsIn30Days,
  NEW_CARDS_PRESETS,
  type NewCardsPreset,
  type StudySettings,
} from "../../lib/study-settings";
import styles from "./Settings.module.css";

type StudySettingsCardProps = {
  isSaving: boolean;
  onSave: (newCardsLimit: number | null) => Promise<void>;
  settings: StudySettings;
};

export function StudySettingsCard({ isSaving, onSave, settings }: StudySettingsCardProps) {
  const [isCustom, setIsCustom] = useState(() => isCustomValue(settings.newCardsLimit));
  const [customValue, setCustomValue] = useState(() =>
    isCustomValue(settings.newCardsLimit) && settings.newCardsLimit !== null
      ? String(settings.newCardsLimit)
      : "",
  );

  const budget =
    typeof settings.newCardsLimit === "number"
      ? Math.max(0, settings.newCardsLimit - (settings.newCardsToday ?? 0))
      : null;

  const activePreset = NEW_CARDS_PRESETS.find((preset) => preset.value === settings.newCardsLimit);
  const showWarning =
    activePreset?.warn === true ||
    (isCustom && settings.newCardsLimit !== null && settings.newCardsLimit >= 40);
  const projectedReviews =
    settings.newCardsLimit !== null ? estimateDailyReviewsIn30Days(settings.newCardsLimit) : null;

  useEffect(() => {
    const custom = isCustomValue(settings.newCardsLimit);
    setIsCustom(custom);
    setCustomValue(custom && settings.newCardsLimit !== null ? String(settings.newCardsLimit) : "");
  }, [settings.newCardsLimit]);

  function handleSelectPreset(preset: NewCardsPreset) {
    setIsCustom(false);
    void onSave(preset.value);
  }

  function handleSelectCustom() {
    setIsCustom(true);
  }

  function handleCustomSubmit() {
    const parsed = parseInt(customValue, 10);

    if (Number.isNaN(parsed) || parsed < 1) {
      return;
    }

    void onSave(parsed);
  }

  return (
    <div className={styles.studySettingsCard}>
      <div className={styles.studySettingsLimitGrid}>
        {NEW_CARDS_PRESETS.map((preset) => (
          <button
            className={`${styles.studySettingsLimitBtn}${
              !isCustom && settings.newCardsLimit === preset.value ? ` ${styles.active}` : ""
            }`}
            disabled={isSaving}
            key={preset.label}
            onClick={() => handleSelectPreset(preset)}
            type="button"
          >
            <span className={styles.studySettingsLimitLabel}>{preset.label}</span>
            <span className={styles.studySettingsLimitValue}>{preset.description}</span>
          </button>
        ))}

        <button
          className={`${styles.studySettingsLimitBtn}${isCustom ? ` ${styles.active}` : ""}`}
          disabled={isSaving}
          onClick={handleSelectCustom}
          type="button"
        >
          <span className={styles.studySettingsLimitLabel}>Custom</span>
          <span className={styles.studySettingsLimitValue}>Set your own limit</span>
        </button>
      </div>

      {isCustom ? (
        <div className={styles.studySettingsCustomRow}>
          <input
            className={`${styles.settingsTextInput} ${styles.studySettingsCustomInput}`}
            disabled={isSaving}
            inputMode="numeric"
            onChange={(event) => setCustomValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleCustomSubmit();
              }
            }}
            placeholder="e.g. 30"
            type="text"
            value={customValue}
          />
          <button
            className={styles.studySettingsCustomSave}
            disabled={
              isSaving ||
              !customValue.trim() ||
              Number.isNaN(parseInt(customValue, 10)) ||
              parseInt(customValue, 10) < 1
            }
            onClick={handleCustomSubmit}
            type="button"
          >
            {isSaving ? "Saving…" : "Apply"}
          </button>
        </div>
      ) : null}

      {showWarning && projectedReviews !== null ? (
        <div className={styles.studySettingsWarning}>
          <span className={styles.studySettingsWarningIcon}>⚠</span>
          <span className={styles.studySettingsWarningText}>
            At {settings.newCardsLimit} new cards/day you'll likely face ~{projectedReviews}{" "}
            reviews/day within a month. High new-card rates are the #1 cause of review debt and
            burnout.
          </span>
        </div>
      ) : null}

      <div className={styles.studySettingsStatus}>
        <span className={styles.studySettingsStatusDot} />
        <span className={styles.studySettingsStatusText}>
          {budget !== null ? (
            <>
              <strong>{settings.newCardsToday}</strong> new card
              {settings.newCardsToday === 1 ? "" : "s"} introduced today
              {" · "}
              <strong>{budget}</strong> remaining
            </>
          ) : (
            <>
              <strong>{settings.newCardsToday}</strong> new card
              {settings.newCardsToday === 1 ? "" : "s"} introduced today · no limit set
            </>
          )}
        </span>
      </div>
    </div>
  );
}

function isCustomValue(newCardsLimit: number | null): boolean {
  return (
    newCardsLimit !== null && !NEW_CARDS_PRESETS.some((preset) => preset.value === newCardsLimit)
  );
}
