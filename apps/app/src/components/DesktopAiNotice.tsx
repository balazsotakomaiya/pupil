import { DESKTOP_DOWNLOAD_URL } from "../lib/links";
import styles from "./DesktopAiNotice.module.css";
import { SparklesIcon } from "./icons/AiGenerateIcons";
import { DownloadIcon } from "./icons/SettingsIcons";

type DesktopAiNoticeProps = {
  layout?: "page" | "panel" | "section";
};

export function DesktopAiNotice({ layout = "page" }: DesktopAiNoticeProps) {
  return (
    <div className={`${styles.notice} ${styles[layout]}`}>
      <div className={styles.icon} aria-hidden="true">
        <SparklesIcon />
      </div>
      <h2 className={styles.title}>AI needs the desktop app</h2>
      <p className={styles.body}>
        Card generation and study explanations talk to your provider from this device. The browser
        preview can&apos;t do that, so those tools live in Pupil for desktop.
      </p>
      <a className={styles.cta} href={DESKTOP_DOWNLOAD_URL} rel="noreferrer" target="_blank">
        <DownloadIcon />
        Download Pupil
      </a>
      <p className={styles.hint}>macOS, Windows, and Linux. No account required.</p>
    </div>
  );
}
