import { useState } from "react";
import { type AppTheme, applyTheme, getSavedTheme } from "../../lib/theme";
import { EyeLogo } from "../dashboard/EyeLogo";
import styles from "./AppearanceSettingsCard.module.css";

const THEME_OPTIONS: Array<{ description: string; label: string; value: AppTheme }> = [
  { description: "The original near-black interface.", label: "Dark", value: "dark" },
  { description: "A bright white canvas for daytime study.", label: "White", value: "light" },
];

export function AppearanceSettingsCard() {
  const [theme, setTheme] = useState<AppTheme>(getSavedTheme);

  function selectTheme(nextTheme: AppTheme) {
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <div className={styles.appearanceCard}>
      <div className={styles.appearanceIntro}>
        <div className={styles.logoPreview} aria-hidden="true">
          <EyeLogo height={22} width={22} />
          <span>pupil</span>
        </div>
        <div>
          <div className={styles.appearanceLabel}>Interface theme</div>
          <p className={styles.appearanceHint}>Your choice is saved on this device.</p>
        </div>
      </div>

      <div className={styles.themeOptions} role="group" aria-label="Interface theme">
        {THEME_OPTIONS.map((option) => {
          const isSelected = theme === option.value;

          return (
            <button
              aria-pressed={isSelected}
              className={`${styles.themeOption}${isSelected ? ` ${styles.selected}` : ""}`}
              key={option.value}
              onClick={() => selectTheme(option.value)}
              type="button"
            >
              <span className={`${styles.themeSwatch} ${styles[option.value]}`} aria-hidden="true">
                <span className={styles.swatchLine} />
                <span className={styles.swatchBlock} />
              </span>
              <span className={styles.themeOptionCopy}>
                <span className={styles.themeOptionLabel}>{option.label}</span>
                <span className={styles.themeOptionDescription}>{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
