import { useEffect, useState } from "react";
import { getUpdateActionLabel, getUpdateHint, isUpdateBusy } from "../../lib/app-update";
import { useAppUpdateStore } from "../../lib/app-update-store";
import { APP_VERSION_FALLBACK, formatAppVersion, getAppVersion } from "../../lib/app-version";
import { EyeLogo } from "../brand";
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
  const errorMessage = useAppUpdateStore((state) => state.errorMessage);
  const install = useAppUpdateStore((state) => state.install);
  const notes = useAppUpdateStore((state) => state.notes);
  const phase = useAppUpdateStore((state) => state.phase);
  const progress = useAppUpdateStore((state) => state.progress);
  const refresh = useAppUpdateStore((state) => state.refresh);
  const version = useAppUpdateStore((state) => state.version);
  const snapshot = { currentVersion: null, errorMessage, notes, phase, progress, version };
  const actionLabel = getUpdateActionLabel(snapshot);
  const hint = getUpdateHint(snapshot);
  const busy = isUpdateBusy(phase);
  const showProgress = phase === "downloading" || phase === "restarting";

  useEffect(() => {
    let cancelled = false;

    async function loadVersion() {
      const versionValue = await getAppVersion();
      if (!cancelled) {
        setVersionLabel(formatAppVersion(versionValue));
      }
    }

    void loadVersion();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleUpdateAction() {
    if (phase === "available") {
      void install();
      return;
    }

    void refresh();
  }

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
        <div className={styles.settingsAboutUpdate}>
          <div className={styles.settingsAboutRow}>
            <span className={styles.settingsAboutLabel}>Updates</span>
            <button
              className={styles.settingsAboutUpdateBtn}
              disabled={busy}
              onClick={handleUpdateAction}
              type="button"
            >
              {actionLabel}
            </button>
          </div>
          {hint ? <p className={styles.settingsAboutUpdateHint}>{hint}</p> : null}
          {showProgress ? (
            <div className={styles.settingsAboutUpdateTrack}>
              <div
                className={`${styles.settingsAboutUpdateFill}${phase === "restarting" ? ` ${styles.done}` : ""}`}
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          ) : null}
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
