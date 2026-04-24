import styles from "./RulersOverlay.module.css";

export function RulersOverlay() {
  return (
    <div aria-hidden="true" className={styles.rulers}>
      <div className={`${styles.rulerV} ${styles.left}`} />
      <div className={`${styles.rulerV} ${styles.right}`} />
      <div className={`${styles.rulerV} ${styles.contentLeft}`} />
      <div className={`${styles.rulerV} ${styles.contentRight}`} />
      <div className={`${styles.rulerH} ${styles.top}`} />
      <div className={`${styles.rulerH} ${styles.bottom}`} />
    </div>
  );
}
