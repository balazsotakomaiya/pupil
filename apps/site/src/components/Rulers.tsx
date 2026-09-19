import { useEffect, useRef } from "react";
import { cx } from "../lib/cx";
import styles from "./Rulers.module.css";

export default function Rulers() {
  const rulersRef = useRef<HTMLDivElement>(null);

  // Tint the vertical rulers while they pass over the hero dither gradient.
  // The tint layer is positioned/sized to match the backdrop in viewport
  // coordinates, so it eases back to the normal ruler color as the image ends.
  useEffect(() => {
    const rulers = rulersRef.current;
    if (!rulers) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const backdrop = document.querySelector("[class*=heroBackdrop]");
      if (!backdrop) {
        rulers.style.setProperty("--hero-shift", "-10000px");
        rulers.style.setProperty("--hero-tint-height", "0px");
        return;
      }
      const rect = backdrop.getBoundingClientRect();
      rulers.style.setProperty("--hero-shift", `${rect.top}px`);
      rulers.style.setProperty("--hero-tint-height", `${rect.height}px`);
    };
    const scheduleUpdate = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className={styles.rulers} aria-hidden="true" ref={rulersRef}>
      <div className={cx(styles.ruler, styles.rulerV, styles.rulerOuterLeft)} />
      <div className={cx(styles.ruler, styles.rulerV, styles.rulerOuterRight)} />
      <div className={cx(styles.ruler, styles.rulerV, styles.rulerContentLeft)} />
      <div className={cx(styles.ruler, styles.rulerV, styles.rulerContentRight)} />
      <div className={cx(styles.ruler, styles.rulerH, styles.rulerTop)} />
      <div className={cx(styles.ruler, styles.rulerH, styles.rulerBottom)} />
    </div>
  );
}
