import { useEffect, useState } from "react";
import { EyeLogo } from "../dashboard/EyeLogo";
import { APP_VERSION_FALLBACK, formatAppVersion, getAppVersion } from "../../lib/app-version";
import { ExternalLinkIcon } from "./SettingsIcons";

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
    <div className="settings-about-card">
      <div className="settings-about-top">
        <div className="settings-about-logo-box">
          <EyeLogo />
        </div>
        <div>
          <div className="settings-about-name">pupil</div>
          <div className="settings-about-version">{versionLabel}</div>
        </div>
      </div>

      <div className="settings-about-meta">
        <div className="settings-about-row">
          <span className="settings-about-label">License</span>
          <span className="settings-about-val">MIT</span>
        </div>
        <div className="settings-about-row">
          <span className="settings-about-label">Runtime</span>
          <span className="settings-about-val">Tauri v2 + React 19</span>
        </div>
        <div className="settings-about-row">
          <span className="settings-about-label">Scheduler</span>
          <span className="settings-about-val">FSRS-5</span>
        </div>
        <div className="settings-about-row">
          <span className="settings-about-label">Schema</span>
          <span className="settings-about-val">0001_init</span>
        </div>
        <div className="settings-about-row">
          <span className="settings-about-label">Database</span>
          <span className="settings-about-val">SQLite local store</span>
        </div>
      </div>

      <div className="settings-about-links">
        <button className="settings-about-link" onClick={onOpenGithub} type="button">
          <ExternalLinkIcon />
          GitHub
        </button>
        <button className="settings-about-link" onClick={onOpenDocs} type="button">
          <ExternalLinkIcon />
          Documentation
        </button>
        <button className="settings-about-link" onClick={onOpenIssues} type="button">
          <ExternalLinkIcon />
          Report Issue
        </button>
      </div>
    </div>
  );
}
