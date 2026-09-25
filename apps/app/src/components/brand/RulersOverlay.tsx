import styles from "./RulersOverlay.module.css";

type RulersOverlayProps = {
  /** Draw the rulers in from their edges instead of showing them at rest. */
  drawIn?: boolean;
};

export function RulersOverlay({ drawIn = false }: RulersOverlayProps) {
  return (
    <div aria-hidden="true" className={`${styles.rulers} ${drawIn ? styles.drawIn : ""}`}>
      <div className={`${styles.rulerV} ${styles.left}`} />
      <div className={`${styles.rulerV} ${styles.right}`} />
      <div className={`${styles.rulerV} ${styles.contentLeft}`} />
      <div className={`${styles.rulerV} ${styles.contentRight}`} />
      <div className={`${styles.rulerH} ${styles.top}`} />
      <div className={`${styles.rulerH} ${styles.bottom}`} />
    </div>
  );
}
