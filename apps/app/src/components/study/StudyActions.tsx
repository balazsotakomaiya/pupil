import type { FsrsPreview } from "../../lib/fsrs";
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
      <div className="session-actions">
        <button
          className="session-reveal-btn"
          disabled={isSubmitting}
          onClick={onReveal}
          type="button"
        >
          Show answer
          <span className="session-reveal-kbd">Space</span>
        </button>
        {error ? <span className="session-error-text">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="session-actions">
      <div className="session-rating-row">
        {([1, 2, 3, 4] as const).map((grade) => (
          <button
            disabled={isSubmitting}
            className={`session-rating-btn ${GRADE_CLASS_NAMES[grade]}${
              pressedGrade === grade ? " pressed" : ""
            }`}
            key={grade}
            onClick={() => onRate(grade)}
            type="button"
          >
            <span className="session-rating-label">{GRADE_LABELS[grade]}</span>
            <span className="session-rating-interval">
              {intervalPreviews.find((preview) => preview.grade === grade)?.intervalLabel ?? "—"}
            </span>
            <span className="session-rating-key">{GRADE_KEYS[grade]}</span>
          </button>
        ))}
      </div>
      <span className="session-rating-hint">
        {error ? error : isSubmitting ? "Saving review…" : "Press 1–4 to rate"}
      </span>
    </div>
  );
}
