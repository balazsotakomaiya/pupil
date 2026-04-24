import { BackIcon } from "../ai-generate/AiGenerateIcons";
import { EyeLogo } from "../dashboard/EyeLogo";
import styles from "./ImportTitlebar.module.css";

type ImportTitlebarProps = {
  backLabel: string;
  onBack: () => void;
};

export function ImportTitlebar({ backLabel, onBack }: ImportTitlebarProps) {
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

        <span className={styles.breadcrumbName}>Import</span>
      </div>

      <div className={styles.titlebarRight} />
    </div>
  );
}
