import { useEffect, useState } from "react";
import { APP_VERSION_FALLBACK, formatAppVersion, getAppVersion } from "../../lib/app-version";
import { EyeLogo } from "../dashboard/EyeLogo";
import { ExternalLinkIcon } from "../icons/SettingsIcons";
import styles from "./Settings.module.css";

type SettingsAboutCardProps = {
  onOpenDocs: () => void;
  onOpenGithub: () => void;
  onOpenIssues: () => void;
};

export function SettingsAboutCard({
  onOpenDocs,
  onOpenGithub,
  onOpenIssues,
}: SettingsAboutCardProps) {
  const [versionLabel, setVersionLabel] = useState(() => formatAppVersion(APP_VERSION_FALLBACK));

  useEffect(() => {
    let cancelled = false;

    async function loadVersion() {
      const version = await getAppVersion();
      if (!cancelled) {
        setVersionLabel(formatAppVersion(version));
      }
    }

    void loadVersion();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.settingsAboutCard}>
      <div className={styles.settingsAboutTop}>
        <div className={styles.settingsAboutLogoBox}>
          <EyeLogo height={22} width={22} />
        </div>
        <div>
          <div className={styles.settingsAboutName}>pupil</div>
          <div className={styles.settingsAboutVersion}>{versionLabel}</div>
        </div>
      </div>

      <p className={styles.settingsSectionDesc}>
        Open-source flashcards. Your study data stays on this device.
      </p>

      <div className={styles.settingsAboutMeta}>
        <div className={styles.settingsAboutRow}>
          <span className={styles.settingsAboutLabel}>License</span>
          <span className={styles.settingsAboutVal}>MIT</span>
        </div>
      </div>

      <div className={styles.settingsAboutLinks}>
        <button className={styles.settingsAboutLink} onClick={onOpenGithub} type="button">
          <ExternalLinkIcon />
          GitHub
        </button>
        <button className={styles.settingsAboutLink} onClick={onOpenDocs} type="button">
          <ExternalLinkIcon />
          Documentation
        </button>
        <button className={styles.settingsAboutLink} onClick={onOpenIssues} type="button">
          <ExternalLinkIcon />
          Report Issue
        </button>
      </div>
    </div>
  );
}
