import type { ReactNode } from "react";
import styles from "./Onboarding.module.css";
import { ChevronRightIcon } from "./OnboardingIcons";

type OnboardingPathCardProps = {
  badge?: string;
  ctaLabel: string;
  description: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  title: string;
};

export function OnboardingPathCard({
  badge,
  ctaLabel,
  description,
  icon,
  onClick,
  title,
}: OnboardingPathCardProps) {
  return (
    <button className={styles.welcomePathCard} onClick={onClick} type="button">
      {badge ? <span className={styles.welcomePathBadge}>{badge}</span> : null}
      <div className={styles.welcomePathIcon}>{icon}</div>
      <div className={styles.welcomePathTitle}>{title}</div>
      <div className={styles.welcomePathDesc}>{description}</div>
      <div className={styles.welcomePathCta}>
        {ctaLabel}
        <ChevronRightIcon />
      </div>
    </button>
  );
}
