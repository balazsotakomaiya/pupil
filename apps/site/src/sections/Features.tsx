import { FEATURES } from "../data/features";
import shared from "../styles/shared.module.css";
import styles from "./Features.module.css";

export default function Features() {
  return (
    <section className={shared.section} id="features">
      <p className={shared.sectionLabel}>Features</p>
      <h2 className={shared.sectionTitle}>Spaced repetition, without the friction</h2>
      <p className={shared.sectionDesc}>
        All the rigor of the algorithm. None of the setup. Powered by AI so you can go from topic to
        drill in seconds.
      </p>
      <div className={styles.featuresGrid}>
        {FEATURES.map((f) => (
          <div className={styles.featureCard} key={f.title}>
            <div className={styles.featureIcon}>{f.icon}</div>
            <p className={styles.featureTitle}>{f.title}</p>
            <p className={styles.featureDesc}>{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
