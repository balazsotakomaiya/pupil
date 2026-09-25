import styles from "../app-shell/AppTitlebar.module.css";
import { Button } from "../Button";
import { EyeLogo } from "../brand";
import { BackIcon } from "../icons/AiGenerateIcons";

type AiGenerateTitlebarProps = {
  backLabel: string;
  onBack: () => void;
};

export function AiGenerateTitlebar({ backLabel, onBack }: AiGenerateTitlebarProps) {
  return (
    <div className={styles.titlebar} data-window-drag>
      <div className={styles.titlebarLeft}>
        <div className={styles.titlebarLogo}>
          <EyeLogo />
          <span className={styles.titlebarLogoText}>pupil</span>
        </div>

        <div className={styles.titlebarSep} />

        <Button className={styles.backBtn} onClick={onBack} variant="bare">
          <BackIcon />
          {backLabel}
        </Button>

        <div className={styles.titlebarSep} />

        <span className={styles.breadcrumbName}>AI Generate</span>
      </div>

      <div className={styles.titlebarRight} />
    </div>
  );
}
