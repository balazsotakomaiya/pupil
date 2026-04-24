import type { FsrsPreview } from "../../lib/fsrs";
import styles from "./Study.module.css";
import type { StudyGrade } from "./types";

type StudyActionsProps = {
  error: string | null;
  intervalPreviews: FsrsPreview[];
  isAnswerVisible: boolean;
  isSubmitting: boolean;
  onRate: (grade: StudyGrade) => void;
  onReveal: () => void;
  pressedGrade: StudyGrade | null;
};

const GRADE_KEYS: Record<StudyGrade, string> = {
  1: "1",
  2: "2",
  3: "3",
  4: "4",
};

const GRADE_LABELS: Record<StudyGrade, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
};

const GRADE_CLASS_NAMES: Record<StudyGrade, string> = {
  1: "again",
  2: "hard",
  3: "good",
  4: "easy",
};

export function StudyActions({
  error,
  intervalPreviews,
  isAnswerVisible,
  isSubmitting,
  onRate,
  onReveal,
  pressedGrade,
}: StudyActionsProps) {
  if (!isAnswerVisible) {
    return (
      <div className={styles.sessionActions}>
        <button
          className={styles.sessionRevealBtn}
          disabled={isSubmitting}
          onClick={onReveal}
          type="button"
        >
          Show answer
          <span className={styles.sessionRevealKbd}>Space</span>
        </button>
        {error ? <span className={styles.sessionErrorText}>{error}</span> : null}
      </div>
    );
  }

  return (
    <div className={styles.sessionActions}>
      <div className={styles.sessionRatingRow}>
        {([1, 2, 3, 4] as const).map((grade) => (
          <button
            disabled={isSubmitting}
            className={`${styles.sessionRatingBtn} ${styles[GRADE_CLASS_NAMES[grade]]}${
              pressedGrade === grade ? ` ${styles.pressed}` : ""
            }`}
            key={grade}
            onClick={() => onRate(grade)}
            type="button"
          >
            <span className={styles.sessionRatingLabel}>{GRADE_LABELS[grade]}</span>
            <span className={styles.sessionRatingInterval}>
              {intervalPreviews.find((preview) => preview.grade === grade)?.intervalLabel ?? "—"}
            </span>
            <span className={styles.sessionRatingKey}>{GRADE_KEYS[grade]}</span>
          </button>
        ))}
      </div>
      <span className={styles.sessionRatingHint}>
        {error ? error : isSubmitting ? "Saving review…" : "Press 1–4 to rate"}
      </span>
    </div>
  );
}
