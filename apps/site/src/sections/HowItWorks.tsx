import { STEPS } from "../data/steps";
import shared from "../styles/shared.module.css";
import styles from "./HowItWorks.module.css";

export default function HowItWorks() {
  return (
    <section className={shared.section} id="how-it-works">
      <p className={shared.sectionLabel}>How it works</p>
      <h2 className={shared.sectionTitle}>From topic to retained in minutes</h2>
      <p className={shared.sectionDesc}>
        No setup, no configuration. Just tell Pupil what you want to learn.
      </p>
      <div className={styles.steps}>
        {STEPS.map((step, i) => (
          <div className={styles.step} key={step.title}>
            <div className={styles.stepNumber}>
              <span>{String(i + 1).padStart(2, "0")}</span>
            </div>
            <p className={styles.stepTitle}>{step.title}</p>
            <p className={styles.stepDesc}>{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
