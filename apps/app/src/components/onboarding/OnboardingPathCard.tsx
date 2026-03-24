import type { ReactNode } from "react";
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
    <button className="welcome-path-card" onClick={onClick} type="button">
      {badge ? <span className="welcome-path-badge">{badge}</span> : null}
      <div className="welcome-path-icon">{icon}</div>
      <div className="welcome-path-title">{title}</div>
      <div className="welcome-path-desc">{description}</div>
      <div className="welcome-path-cta">
        {ctaLabel}
        <ChevronRightIcon />
      </div>
    </button>
  );
}
