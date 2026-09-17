import { useState } from "react";
import Lightbox from "../components/Lightbox";
import ScreenshotFrame from "../components/ScreenshotFrame";
import { AI_GENERATE_FEATURE, SCREENSHOTS } from "../data/screenshots";
import { cx } from "../lib/cx";
import shared from "../styles/shared.module.css";
import styles from "./ProductTour.module.css";

export default function ProductTour() {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const openLightbox = (src: string, alt: string) => setLightbox({ src, alt });
  const closeLightbox = () => setLightbox(null);

  return (
    <section className={cx(shared.section, styles.productTour)} id="screenshots">
      <p className={shared.sectionLabel}>Inside the app</p>
      <h2 className={shared.sectionTitle}>A closer look at Pupil</h2>
      <p className={shared.sectionDesc}>
        Generate a deck, approve the cards, study with FSRS, and see which spaces need attention.
      </p>
      <div className={styles.screenshotFeature}>
        <div className={styles.screenshotCopy}>
          <p className={styles.screenshotKicker}>{AI_GENERATE_FEATURE.kicker}</p>
          <h3>{AI_GENERATE_FEATURE.heading}</h3>
          <p>{AI_GENERATE_FEATURE.body}</p>
        </div>
        <ScreenshotFrame
          src={AI_GENERATE_FEATURE.src}
          alt={AI_GENERATE_FEATURE.alt}
          onOpen={openLightbox}
          className={styles.cardFrame}
        />
      </div>
      <div className={styles.screenshotGrid}>
        {SCREENSHOTS.map((screenshot, i) => {
          const isWide = i === 4 || i === 5;
          return (
            <article
              className={cx(styles.screenshotCard, isWide && styles.screenshotCardWide)}
              key={screenshot.title}
            >
              <ScreenshotFrame
                src={screenshot.src}
                alt={screenshot.alt}
                onOpen={openLightbox}
                className={cx(styles.cardFrame, isWide && styles.wideFrame)}
              />
              <div className={cx(styles.screenshotCardCopy, isWide && styles.wideCardCopy)}>
                <p>{screenshot.title}</p>
                <span>{screenshot.caption}</span>
              </div>
            </article>
          );
        })}
      </div>

      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={closeLightbox} />}
    </section>
  );
}
