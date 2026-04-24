import styles from "../app-shell/AppTitlebar.module.css";
import { EyeLogo } from "../dashboard/EyeLogo";
import { BackIcon } from "./AiGenerateIcons";

type AiGenerateTitlebarProps = {
  backLabel: string;
  onBack: () => void;
};

export function AiGenerateTitlebar({ backLabel, onBack }: AiGenerateTitlebarProps) {
  return (
    <div className={styles.titlebar}>
      <div className={styles.titlebarLeft}>
        <div className={styles.titlebarLogo}>
          <EyeLogo />
          <span className={styles.titlebarLogoText}>pupil</span>
        </div>

        <div className={styles.titlebarSep} />

        <button className={styles.backBtn} onClick={onBack} type="button">
          <BackIcon />
          {backLabel}
        </button>

        <div className={styles.titlebarSep} />

        <span className={styles.breadcrumbName}>AI Generate</span>
      </div>

      <div className={styles.titlebarRight} />
    </div>
  );
}
