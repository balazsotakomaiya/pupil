import {
  type CSSProperties,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { DEMO_DECK, RATINGS, type Rating, spellInterval } from "../data/demoDeck";
import { cx } from "../lib/cx";
import styles from "./StudyDemo.module.css";

type Phase = "front" | "back" | "rated" | "leaving";

// Rated → leaving → next card. Long enough to read the scheduled interval.
const RATED_HOLD_MS = 900;
const LEAVE_MS = 420;

export default function StudyDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("front");
  const [rating, setRating] = useState<Rating | null>(null);
  const [log, setLog] = useState<{ front: string; interval: string }[]>([]);

  const done = index >= DEMO_DECK.length;
  const card = DEMO_DECK[Math.min(index, DEMO_DECK.length - 1)];
  const remaining = DEMO_DECK.length - index;

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const keepFocus = () => rootRef.current?.focus({ preventScroll: true });

  const reveal = useCallback(() => {
    if (phase !== "front" || done) return;
    setPhase("back");
    keepFocus();
  }, [phase, done]);

  const rate = useCallback(
    (r: Rating) => {
      if (phase !== "back") return;
      setRating(r);
      setPhase("rated");
      setLog((prev) => [...prev, { front: card.front, interval: card.intervals[r] }]);
      keepFocus();
      later(() => setPhase("leaving"), RATED_HOLD_MS);
      later(() => {
        setIndex((i) => i + 1);
        setPhase("front");
        setRating(null);
      }, RATED_HOLD_MS + LEAVE_MS);
    },
    [phase, card],
  );

  const restart = () => {
    setIndex(0);
    setPhase("front");
    setRating(null);
    setLog([]);
    keepFocus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === " " || e.key === "Enter") {
      if (phase === "front" && !done) {
        e.preventDefault();
        reveal();
      }
      return;
    }
    const match = RATINGS.find((r) => r.key === e.key);
    if (match && phase === "back") {
      e.preventDefault();
      rate(match.id);
    }
  };

  return (
    <div className={styles.demo}>
      <div
        ref={rootRef}
        className={styles.stage}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        role="group"
        aria-label="Try a study session: reveal each answer, then rate how well you remembered it"
      >
        {/* The rest of the deck, waiting underneath */}
        {!done &&
          [2, 1].map((depth) =>
            remaining > depth ? (
              <div
                key={depth}
                className={styles.ghost}
                style={{ "--depth": depth } as CSSProperties}
                aria-hidden="true"
              />
            ) : null,
          )}

        {done ? (
          <div className={cx(styles.card, styles.summary)} key="summary">
            <div className={styles.cardHead}>
              <span className={styles.chip}>Session complete</span>
              <span className={styles.count}>
                {log.length} / {DEMO_DECK.length}
              </span>
            </div>
            <p className={styles.summaryTitle}>Every card now has its own next review.</p>
            <ol className={styles.schedule}>
              {log.map((entry) => (
                <li key={entry.front}>
                  <span className={styles.scheduleFront}>{entry.front}</span>
                  <span className={styles.scheduleWhen}>{spellInterval(entry.interval)}</span>
                </li>
              ))}
            </ol>
            <button type="button" className={styles.showAnswer} onClick={restart}>
              Study again
            </button>
          </div>
        ) : (
          <div
            className={cx(
              styles.card,
              phase === "front" && styles.cardFront,
              phase === "leaving" && (rating === "again" ? styles.leaveBack : styles.leave),
            )}
            key={index}
            onClick={phase === "front" ? reveal : undefined}
          >
            <div className={styles.cardHead}>
              <span className={styles.chip}>{card.space}</span>
              <span className={styles.count}>
                {index + 1} / {DEMO_DECK.length}
              </span>
            </div>

            <div className={cx(styles.body, phase !== "front" && styles.bodyRevealed)}>
              <p className={styles.front}>{card.front}</p>
              {phase !== "front" && (
                <>
                  <span className={styles.rule} aria-hidden="true" />
                  <p className={styles.back}>{card.back}</p>
                </>
              )}
            </div>

            {phase === "front" ? (
              <button type="button" className={styles.showAnswer} onClick={reveal}>
                Show answer
                <kbd>Space</kbd>
              </button>
            ) : (
              <div className={styles.ratings}>
                {RATINGS.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    className={cx(
                      styles.rating,
                      rating === r.id && styles.ratingChosen,
                      rating !== null && rating !== r.id && styles.ratingMuted,
                    )}
                    onClick={() => rate(r.id)}
                    disabled={phase !== "back"}
                    aria-label={`${r.label}, next review in ${spellInterval(card.intervals[r.id])}`}
                  >
                    <span className={styles.ratingLabel}>{r.label}</span>
                    <span className={styles.ratingInterval}>{card.intervals[r.id]}</span>
                    <kbd className={styles.ratingKey}>{r.key}</kbd>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p className={styles.caption} aria-live="polite">
        {rating ? (
          <span className={styles.scheduled}>
            <span className={styles.pulse} aria-hidden="true" />
            Next review in {spellInterval(card.intervals[rating])}
          </span>
        ) : done ? (
          <span>That’s the whole loop. Your real decks work the same way.</span>
        ) : (
          <span>
            Try it — <kbd>Space</kbd> to reveal, <kbd>1</kbd>–<kbd>4</kbd> to rate
          </span>
        )}
      </p>
    </div>
  );
}
