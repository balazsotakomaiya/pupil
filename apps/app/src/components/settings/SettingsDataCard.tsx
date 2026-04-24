import type { ReactNode } from "react";
import styles from "./Settings.module.css";

type SettingsDataCardProps = {
  action: ReactNode;
  description: ReactNode;
  title: string;
  tone?: "default" | "danger";
  value?: ReactNode;
};

export function SettingsDataCard({
  action,
  description,
  title,
  tone = "default",
  value,
}: SettingsDataCardProps) {
  return (
    <div className={`${styles.settingsDataCard}${tone === "danger" ? ` ${styles.danger}` : ""}`}>
      <div className={styles.settingsDataCardLeft}>
        <div className={styles.settingsDataCardTitle}>{title}</div>
        <div className={styles.settingsDataCardDesc}>{description}</div>
      </div>

      <div className={styles.settingsDataCardRight}>
        {value ? <span className={styles.settingsDataCardValue}>{value}</span> : null}
        {action}
      </div>
    </div>
  );
}
