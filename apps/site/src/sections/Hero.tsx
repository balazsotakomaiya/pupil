import dashboardScreenshot from "../assets/screenshots/dashboard.png";
import DownloadCTA from "../components/DownloadCTA";
import ScreenshotFrame from "../components/ScreenshotFrame";
import { DESKTOP_APP_VERSION } from "../lib/constants";
import { cx } from "../lib/cx";
import styles from "./Hero.module.css";

function AnimatedHeroTitle() {
  return (
    <h1 className={styles.heroTitle}>
      <span className={styles.heroTitleLine} style={{ animationDelay: "0ms" }}>
        Flashcards that <em>actually</em> work
      </span>
      <br />
      <span className={styles.heroTitleLine} style={{ animationDelay: "130ms" }}>
        with your brain
      </span>
    </h1>
  );
}

export default function Hero() {
  return (
    <section className={cx(styles.hero, styles.heroAnim)}>
      <div className={styles.heroBadge}>
        <span className={styles.heroBadgeChip}>v{DESKTOP_APP_VERSION}</span>
        Open source · Local-first · FSRS-5
      </div>
      <AnimatedHeroTitle />
      <p className={styles.heroDesc}>
        Pupil generates, organizes, and adapts cards to your knowledge gaps using AI and
        science-backed spaced repetition. No account needed.
      </p>
      <div className={styles.heroCtaWrap}>
        <DownloadCTA />
      </div>

      <div className={styles.heroMockup}>
        <ScreenshotFrame
          src={dashboardScreenshot}
          alt="Pupil dashboard showing due cards, study stats, and learning spaces"
          priority
        />
      </div>
    </section>
  );
}
