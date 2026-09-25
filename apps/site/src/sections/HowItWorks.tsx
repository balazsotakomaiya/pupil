import { type CSSProperties, useEffect, useRef, useState } from "react";
import Lightbox from "../components/Lightbox";
import { STEPS } from "../data/steps";
import { ArrowUpRightIcon } from "../icons";
import { cx } from "../lib/cx";
import { prefersReducedMotion, useInView } from "../lib/useInView";
import shared from "../styles/shared.module.css";
import styles from "./HowItWorks.module.css";

const STEP_MS = 6500;

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { threshold: 0.4 });
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userPicked, setUserPicked] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  const autoplay = inView && !paused && !userPicked && !lightbox && !prefersReducedMotion();

  useEffect(() => {
    if (!autoplay) return;
    const t = window.setTimeout(() => setActive((i) => (i + 1) % STEPS.length), STEP_MS);
    return () => window.clearTimeout(t);
  }, [autoplay, active]);

  const pick = (i: number) => {
    setActive(i);
    setUserPicked(true);
  };

  return (
    <section
      ref={sectionRef}
      className={shared.section}
      id="how-it-works"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={shared.sectionHead}>
        <h2 className={shared.sectionTitle}>
          From topic to <em>retained</em> in minutes
        </h2>
        <p className={shared.sectionDesc}>
          No setup, no configuration. Just tell Pupil what you want to learn — then let the schedule
          do the remembering.
        </p>
      </div>

      <div className={styles.loop} style={{ "--step-ms": `${STEP_MS}ms` } as CSSProperties}>
        <ol className={styles.steps}>
          {STEPS.map((step, i) => {
            const isActive = i === active;
            return (
              <li key={step.title} className={cx(styles.step, isActive && styles.stepActive)}>
                <span className={styles.track} aria-hidden="true">
                  <span
                    key={`${active}-${autoplay}`}
                    className={cx(styles.fill, isActive && autoplay && styles.fillRunning)}
                  />
                </span>
                <button
                  type="button"
                  className={styles.stepButton}
                  onClick={() => pick(i)}
                  aria-pressed={isActive}
                >
                  <span className={styles.stepIndex}>{i + 1}</span>
                  <span className={styles.stepTitle}>{step.title}</span>
                </button>
                <div className={styles.stepBody}>
                  <div>
                    <p className={styles.stepDesc}>{step.desc}</p>
                  </div>
                </div>
                <img
                  className={styles.stepShotInline}
                  src={step.src}
                  alt={step.alt}
                  width={1392}
                  height={1012}
                  loading="lazy"
                  decoding="async"
                />
              </li>
            );
          })}
        </ol>

        <div className={styles.viewer}>
          {STEPS.map((step, i) => (
            <button
              type="button"
              key={step.title}
              className={cx(styles.shot, i === active && styles.shotActive)}
              onClick={() => setLightbox({ src: step.src, alt: step.alt })}
              aria-label={`Enlarge screenshot: ${step.alt}`}
              aria-hidden={i !== active}
              tabIndex={i === active ? 0 : -1}
            >
              <img
                src={step.src}
                alt=""
                width={1392}
                height={1012}
                loading="lazy"
                decoding="async"
              />
              <span className={styles.enlarge} aria-hidden="true">
                <ArrowUpRightIcon />
              </span>
            </button>
          ))}
        </div>
      </div>

      {lightbox && (
        <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
    </section>
  );
}
