import styles from "./Onboarding.module.css";
import { ChevronRightIcon, ExploreAppIcon } from "./OnboardingIcons";

type OnboardingQuickStartProps = {
  onClick: () => void;
};

export function OnboardingQuickStart({ onClick }: OnboardingQuickStartProps) {
  return (
    <button className={styles.welcomeQuickstartCard} onClick={onClick} type="button">
      <div className={styles.welcomeQuickstartLeft}>
        <div className={styles.welcomeQuickstartIcon}>
          <ExploreAppIcon />
        </div>
        <div className={styles.welcomeQuickstartText}>
          <div className={styles.welcomeQuickstartTitle}>Just explore the app</div>
          <div className={styles.welcomeQuickstartDesc}>
            Skip setup and head to the dashboard. You can create spaces, import, or generate cards
            later.
          </div>
        </div>
      </div>
      <div className={styles.welcomeQuickstartArrow}>
        <ChevronRightIcon />
      </div>
    </button>
  );
}
