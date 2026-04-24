import styles from "./Settings.module.css";

type SettingsConnectionStatusProps = {
  detail?: string;
  kind: "idle" | "success" | "error";
  label: string;
};

export function SettingsConnectionStatus({ detail, kind, label }: SettingsConnectionStatusProps) {
  return (
    <div className={`${styles.settingsConnectionStatus} ${styles[kind]}`}>
      <span className={styles.statusDot} />
      {label}
      {detail ? <span className={styles.statusDetail}>{detail}</span> : null}
    </div>
  );
}
