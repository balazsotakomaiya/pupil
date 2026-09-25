import DownloadCTA from "../components/DownloadCTA";
import Platforms from "../components/Platforms";
import StudyDemo from "../components/StudyDemo";
import { DASHBOARD_SCREENSHOT } from "../data/screenshots";
import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroBackdrop} aria-hidden="true" />

      <div className={styles.heroInner}>
        <div className={styles.copy}>
          <h1 className={styles.heroTitle}>
            <span className={styles.line} style={{ animationDelay: "200ms" }}>
              Flashcards that
            </span>{" "}
            <span className={styles.line} style={{ animationDelay: "290ms" }}>
              <em>actually</em> work
            </span>{" "}
            <span className={styles.line} style={{ animationDelay: "380ms" }}>
              with your brain
            </span>
          </h1>
          <p className={styles.heroDesc}>
            Pupil generates, organizes, and adapts cards to your knowledge gaps using AI and
            science-backed spaced repetition. No account needed.
          </p>
          <div className={styles.heroCta}>
            <DownloadCTA onBackdrop />
          </div>
        </div>

        <div className={styles.demoWrap}>
          <StudyDemo />
        </div>
      </div>

      <div className={styles.shot}>
        <img
          className={styles.shotImg}
          src={DASHBOARD_SCREENSHOT.src}
          alt={DASHBOARD_SCREENSHOT.alt}
          width={1392}
          height={1012}
          loading="eager"
          decoding="async"
        />
      </div>

      <Platforms className={styles.platforms} />
    </section>
  );
}
