import DownloadCTA from "../components/DownloadCTA";
import PupilEye from "../components/PupilEye";
import styles from "./FinalCta.module.css";

export default function FinalCta() {
  return (
    <section className={styles.ctaSection}>
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.inner}>
        <PupilEye size={64} className={styles.eye} />
        <h2 className={styles.ctaTitle}>
          Ready to <em>actually</em> remember things?
        </h2>
        <p className={styles.ctaDesc}>
          Free. Open source. No account. Your cards stay on your device.
        </p>
        <DownloadCTA onBackdrop align="center" />
      </div>
    </section>
  );
}
