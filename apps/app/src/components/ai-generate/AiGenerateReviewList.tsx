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
    <div className="ai-gen-state-view active">
      <div className="ai-gen-review-section">
        <div className="ai-gen-review-header">
          <div className="ai-gen-review-header-left">
            <div className="ai-gen-review-title">Review generated cards</div>
            <div className="ai-gen-review-count">
              <strong>{approvedCount}</strong> approved · <strong>{discardedCount}</strong>{" "}
              discarded · <strong>{cards.length}</strong> total
            </div>
          </div>
          <div className="ai-gen-review-bulk-actions">
            <button className="ai-gen-bulk-btn" onClick={onBulkDiscard} type="button">
              <CloseIcon />
              Discard all
            </button>
            <button className="ai-gen-bulk-btn approve" onClick={onBulkApprove} type="button">
              <CheckIcon />
              Approve all
            </button>
          </div>
        </div>

        <div className="ai-gen-review-list">
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

        <div className="ai-gen-save-bar">
          <div className="ai-gen-save-bar-info">
            <strong>{approvedCount}</strong> cards ready to save to {targetSpaceName}
          </div>
          <button
            className="ai-gen-save-bar-btn"
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
