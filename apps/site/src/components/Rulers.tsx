import { cx } from "../lib/cx";
import styles from "./Rulers.module.css";

export default function Rulers() {
  return (
    <div className={styles.rulers} aria-hidden="true">
      <div className={cx(styles.ruler, styles.rulerV, styles.rulerOuterLeft)} />
      <div className={cx(styles.ruler, styles.rulerV, styles.rulerOuterRight)} />
      <div className={cx(styles.ruler, styles.rulerV, styles.rulerContentLeft)} />
      <div className={cx(styles.ruler, styles.rulerV, styles.rulerContentRight)} />
      <div className={cx(styles.ruler, styles.rulerH, styles.rulerTop)} />
      <div className={cx(styles.ruler, styles.rulerH, styles.rulerBottom)} />
    </div>
  );
}
