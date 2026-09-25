import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../lib/cx";
import { useInView } from "../lib/useInView";
import shared from "../styles/shared.module.css";
import styles from "./Science.module.css";

// FSRS-5 forgetting curve: R(t) = (1 + FACTOR · t / S) ^ DECAY.
// With these constants R(S) = 0.9, so a card is due exactly when its stability
// has elapsed — the default 90 % desired retention in ts-fsrs.
const DECAY = -0.5;
const FACTOR = 19 / 81;
const TARGET = 0.9;
const retrievability = (t: number, s: number) => (1 + (FACTOR * t) / s) ** DECAY;

// Illustrative stabilities after each successful review (days).
const STABILITIES = [1, 3, 7, 16, 35, 80];
const DAYS = 70;

type Review = { day: number; interval: number };

function buildReviews(): Review[] {
  const reviews: Review[] = [];
  let day = 0;
  for (const s of STABILITIES) {
    day += s;
    if (day > DAYS) break;
    reviews.push({ day, interval: s });
  }
  return reviews;
}

const REVIEWS = buildReviews();

/** Retention with reviews: resets to 100 % at each review, decaying on the next stability. */
function withReviews(t: number): number {
  let start = 0;
  for (let i = 0; i < STABILITIES.length; i++) {
    const s = STABILITIES[i];
    if (t < start + s || i === STABILITIES.length - 1) return retrievability(t - start, s);
    start += s;
  }
  return 1;
}

const withoutReviews = (t: number) => retrievability(t, STABILITIES[0]);

const PAD = { top: 28, right: 20, bottom: 44, left: 48 };

export default function Science() {
  const frameRef = useRef<HTMLDivElement>(null);
  const inView = useInView(frameRef, { threshold: 0.45, once: true });
  const [width, setWidth] = useState(960);
  const [scrub, setScrub] = useState<number | null>(null);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const compact = width < 560;
  const height = Math.round(Math.min(420, Math.max(280, width * 0.42)));
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const x = (day: number) => PAD.left + (day / DAYS) * innerW;
  const y = (r: number) => PAD.top + (1 - r) * innerH;

  const paths = useMemo(() => {
    const steps = Math.max(200, Math.round(innerW));
    let decayed = "";
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * DAYS;
      decayed += `${i === 0 ? "M" : "L"}${x(t).toFixed(1)},${y(withoutReviews(t)).toFixed(1)}`;
    }

    // Segment by segment so each review is a vertical jump back to 100 %.
    let kept = `M${x(0)},${y(1)}`;
    let start = 0;
    for (const s of STABILITIES) {
      const end = Math.min(start + s, DAYS);
      const n = Math.max(12, Math.round(((end - start) / DAYS) * steps));
      for (let i = 1; i <= n; i++) {
        const t = start + ((end - start) * i) / n;
        kept += `L${x(t).toFixed(1)},${y(retrievability(t - start, s)).toFixed(1)}`;
      }
      if (end >= DAYS) break;
      kept += `L${x(end).toFixed(1)},${y(1).toFixed(1)}`;
      start = end;
    }
    return { decayed, kept };
  }, [innerW, innerH]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const day = ((e.clientX - rect.left - PAD.left) / innerW) * DAYS;
    setScrub(day < 0 || day > DAYS ? null : day);
  };

  const scrubDay = scrub ?? null;
  const yTicks = compact ? [1, 0.5, 0] : [1, 0.75, 0.5, 0.25, 0];
  const xTicks = compact ? [0, 35, 70] : [0, 10, 20, 30, 40, 50, 60, 70];

  return (
    <section className={shared.section} id="science">
      <div className={shared.sectionHead}>
        <h2 className={shared.sectionTitle}>
          Reviews that land <em>right before</em> you forget
        </h2>
        <p className={shared.sectionDesc}>
          Memory fades on a curve. FSRS-5 — the same algorithm modern Anki uses — models that curve
          for every card and brings it back the moment recall would slip below 90%. Each review
          makes the memory sturdier, so the gaps keep growing.
        </p>
      </div>

      <figure className={cx(styles.figure, inView && styles.drawn)}>
        <div className={styles.legend}>
          <span className={styles.legendKept}>With Pupil</span>
          <span className={styles.legendDecayed}>Without review</span>
          <span className={styles.readout} aria-live="off">
            {scrubDay === null ? (
              <span className={styles.readoutHint}>
                <span className={styles.hintHover}>Hover the curve</span>
                <span className={styles.hintTouch}>Drag across the curve</span>
              </span>
            ) : (
              <>
                <span>Day {Math.round(scrubDay)}</span>
                <span className={styles.readoutKept}>
                  {Math.round(withReviews(scrubDay) * 100)}%
                </span>
                <span className={styles.readoutDecayed}>
                  {Math.round(withoutReviews(scrubDay) * 100)}%
                </span>
              </>
            )}
          </span>
        </div>

        <div ref={frameRef} className={styles.frame}>
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className={styles.chart}
            onPointerMove={onMove}
            onPointerLeave={() => setScrub(null)}
            role="img"
            aria-label="Chart: without review, recall of a card falls to about a quarter within ten weeks. With reviews scheduled each time recall reaches 90%, it stays between 90 and 100 percent while the gaps between reviews grow from 1 to 35 days."
          >
            <defs>
              <linearGradient id="keptFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff5a1f" stopOpacity="0.14" />
                <stop offset="45%" stopColor="#ff5a1f" stopOpacity="0.03" />
                <stop offset="100%" stopColor="#ff5a1f" stopOpacity="0" />
              </linearGradient>
            </defs>

            {yTicks.map((r) => (
              <g key={r}>
                <line
                  className={styles.grid}
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(r)}
                  y2={y(r)}
                />
                <text
                  className={styles.tick}
                  x={PAD.left - 12}
                  y={y(r)}
                  textAnchor="end"
                  dy="0.32em"
                >
                  {Math.round(r * 100)}%
                </text>
              </g>
            ))}
            {xTicks.map((d) => (
              <text
                key={d}
                className={styles.tick}
                x={x(d)}
                y={height - PAD.bottom + 22}
                textAnchor={d === 0 ? "start" : d === DAYS ? "end" : "middle"}
              >
                {d === 0 ? "Day 0" : d === DAYS ? `${d} days` : d}
              </text>
            ))}

            <line
              className={styles.target}
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(TARGET)}
              y2={y(TARGET)}
            />
            <text
              className={styles.targetLabel}
              x={width - PAD.right}
              y={y(TARGET) + 16}
              textAnchor="end"
            >
              90% target
            </text>

            <path
              className={styles.area}
              d={`${paths.kept}L${x(DAYS)},${y(0)}L${x(0)},${y(0)}Z`}
              fill="url(#keptFill)"
            />
            <path className={styles.decayed} d={paths.decayed} pathLength={1} />
            <path className={styles.kept} d={paths.kept} pathLength={1} />

            {REVIEWS.map((r, i) => (
              <g
                key={r.day}
                className={styles.review}
                style={{ transitionDelay: `${900 + i * 160}ms` }}
              >
                <circle cx={x(r.day)} cy={y(1)} r={4} />
                {!compact && (
                  <text x={x(r.day)} y={y(1) - 12} textAnchor="middle">
                    +{r.interval}d
                  </text>
                )}
              </g>
            ))}

            {scrubDay !== null && (
              <g className={styles.scrub}>
                <line x1={x(scrubDay)} x2={x(scrubDay)} y1={PAD.top} y2={height - PAD.bottom} />
                <circle
                  className={styles.scrubKept}
                  cx={x(scrubDay)}
                  cy={y(withReviews(scrubDay))}
                  r={4.5}
                />
                <circle
                  className={styles.scrubDecayed}
                  cx={x(scrubDay)}
                  cy={y(withoutReviews(scrubDay))}
                  r={4}
                />
              </g>
            )}
          </svg>
        </div>

        <figcaption className={styles.caption}>
          Modeled with the FSRS-5 forgetting curve, <code>R = (1 + 19/81 · t/S)^−0.5</code>, at the
          default 90% target. Real intervals depend on how you rate each card.
        </figcaption>
      </figure>
    </section>
  );
}
