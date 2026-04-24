import styles from "./AiGenerate.module.css";
import { CheckIcon, CloseIcon } from "./AiGenerateIcons";
import { AiGenerateReviewCard } from "./AiGenerateReviewCard";
import type { GeneratedCardCandidate } from "./types";

type AiGenerateReviewListProps = {
  cards: GeneratedCardCandidate[];
  isRegenerating: string | null;
  isSaving: boolean;
  onApprove: (cardId: string) => void;
  onBulkApprove: () => void;
  onBulkDiscard: () => void;
  onDiscard: (cardId: string) => void;
  onRegenerate: (cardId: string) => void;
  onSave: () => void;
  targetSpaceName: string;
};

export function AiGenerateReviewList({
  cards,
  isRegenerating,
  isSaving,
  onApprove,
  onBulkApprove,
  onBulkDiscard,
  onDiscard,
  onRegenerate,
  onSave,
  targetSpaceName,
}: AiGenerateReviewListProps) {
  const approvedCount = cards.filter((card) => card.status === "approved").length;
  const discardedCount = cards.filter((card) => card.status === "discarded").length;

  return (
    <div className={styles.aiGenStateView}>
      <div className={styles.aiGenReviewSection}>
        <div className={styles.aiGenReviewHeader}>
          <div className={styles.aiGenReviewHeaderLeft}>
            <div className={styles.aiGenReviewTitle}>Review generated cards</div>
            <div className={styles.aiGenReviewCount}>
              <strong>{approvedCount}</strong> approved · <strong>{discardedCount}</strong>{" "}
              discarded · <strong>{cards.length}</strong> total
            </div>
          </div>
          <div className={styles.aiGenReviewBulkActions}>
            <button className={styles.aiGenBulkBtn} onClick={onBulkDiscard} type="button">
              <CloseIcon />
              Discard all
            </button>
            <button
              className={`${styles.aiGenBulkBtn} ${styles.approve}`}
              onClick={onBulkApprove}
              type="button"
            >
              <CheckIcon />
              Approve all
            </button>
          </div>
        </div>

        <div className={styles.aiGenReviewList}>
          {cards.map((card, index) => (
            <AiGenerateReviewCard
              card={card}
              index={index}
              isRegenerating={isRegenerating === card.id}
              key={card.id}
              onApprove={() => onApprove(card.id)}
              onDiscard={() => onDiscard(card.id)}
              onRegenerate={() => onRegenerate(card.id)}
              total={cards.length}
            />
          ))}
        </div>

        <div className={styles.aiGenSaveBar}>
          <div className={styles.aiGenSaveBarInfo}>
            <strong>{approvedCount}</strong> cards ready to save to {targetSpaceName}
          </div>
          <button
            className={styles.aiGenSaveBarBtn}
            disabled={approvedCount === 0 || isSaving || isRegenerating !== null}
            onClick={onSave}
            type="button"
          >
            <CheckIcon />
            {isSaving ? "Saving…" : "Save approved cards"}
          </button>
        </div>
      </div>
    </div>
  );
}
