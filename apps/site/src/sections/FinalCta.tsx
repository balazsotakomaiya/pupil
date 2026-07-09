import DownloadCTA from "../components/DownloadCTA";
import styles from "./FinalCta.module.css";

export default function FinalCta() {
  return (
    <section className={styles.ctaSection}>
      <p className={styles.ctaLabel}>Get started</p>
      <h2 className={styles.ctaTitle}>
        Ready to <em>actually</em> remember things?
      </h2>
      <p className={styles.ctaDesc}>
        Free. Open source. No account. Your cards stay on your device.
      </p>
      <DownloadCTA />
    </section>
  );
}
