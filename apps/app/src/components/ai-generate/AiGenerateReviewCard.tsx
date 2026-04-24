import styles from "./AiGenerate.module.css";
import { CheckIcon, CloseIcon, RotateIcon } from "./AiGenerateIcons";
import type { GeneratedCardCandidate } from "./types";

type AiGenerateReviewCardProps = {
  card: GeneratedCardCandidate;
  index: number;
  isRegenerating: boolean;
  onApprove: () => void;
  onDiscard: () => void;
  onRegenerate: () => void;
  total: number;
};

export function AiGenerateReviewCard({
  card,
  index,
  isRegenerating,
  onApprove,
  onDiscard,
  onRegenerate,
  total,
}: AiGenerateReviewCardProps) {
  return (
    <div
      className={`${styles.aiGenReviewCard}${card.status === "discarded" ? ` ${styles.discarded}` : ""}`}
    >
      <div className={styles.aiGenReviewCardBody}>
        <div className={styles.aiGenReviewCardFront}>{card.front}</div>
        <div className={styles.aiGenReviewCardBack}>{card.back}</div>
      </div>
      <div className={styles.aiGenReviewCardActions}>
        <span className={styles.aiGenReviewCardNum}>
          {index + 1} of {total}
        </span>
        <div className={styles.aiGenReviewCardBtns}>
          <button
            className={styles.aiGenRcBtn}
            disabled={isRegenerating}
            onClick={onRegenerate}
            type="button"
          >
            <RotateIcon />
            {isRegenerating ? "Regenerating…" : "Regenerate"}
          </button>
          <button
            className={styles.aiGenRcBtn}
            disabled={isRegenerating}
            onClick={onDiscard}
            type="button"
          >
            <CloseIcon />
            Discard
          </button>
          <button
            className={`${styles.aiGenRcBtn}${card.status === "approved" ? ` ${styles.approved}` : ` ${styles.approve}`}`}
            disabled={isRegenerating}
            onClick={onApprove}
            type="button"
          >
            <CheckIcon />
            {card.status === "approved" ? "Approved" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}
