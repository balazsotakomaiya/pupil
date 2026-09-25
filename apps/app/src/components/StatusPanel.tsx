import type { ReactNode } from "react";
import { EyeLogo } from "./brand";
import styles from "./StatusPanel.module.css";

type StatusPanelProps = {
  actions?: ReactNode;
  /** `screen` owns the whole window; `content` sits below a titlebar. */
  fill?: "content" | "screen";
  message: string;
  /** `alert` for failures the user should hear about immediately. */
  role?: "alert" | "status";
  title: string;
};

/**
 * Full-screen stand-in for a screen that cannot render: not found, failed to
 * start, or crashed. The closed eye marks it as the app resting, not broken.
 */
export function StatusPanel({
  actions,
  fill = "screen",
  message,
  role = "status",
  title,
}: StatusPanelProps) {
  return (
    <section className={`${styles.statusPanel} ${styles[fill]}`} role={role}>
      {fill === "screen" ? (
        <div aria-hidden="true" className={styles.dragStrip} data-window-drag />
      ) : null}
      <div className={styles.inner}>
        <EyeLogo className={styles.eye} height={36} variant="closed" width={36} />
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.message}>{message}</p>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </section>
  );
}
