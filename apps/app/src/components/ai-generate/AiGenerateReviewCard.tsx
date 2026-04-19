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
    <div className={`ai-gen-review-card${card.status === "discarded" ? " discarded" : ""}`}>
      <div className="ai-gen-review-card-body">
        <div className="ai-gen-review-card-front">{card.front}</div>
        <div className="ai-gen-review-card-back">{card.back}</div>
      </div>
      <div className="ai-gen-review-card-actions">
        <span className="ai-gen-review-card-num">
          {index + 1} of {total}
        </span>
        <div className="ai-gen-review-card-btns">
          <button
            className="ai-gen-rc-btn"
            disabled={isRegenerating}
            onClick={onRegenerate}
            type="button"
          >
            <RotateIcon />
            {isRegenerating ? "Regenerating…" : "Regenerate"}
          </button>
          <button
            className="ai-gen-rc-btn"
            disabled={isRegenerating}
            onClick={onDiscard}
            type="button"
          >
            <CloseIcon />
            Discard
          </button>
          <button
            className={`ai-gen-rc-btn${card.status === "approved" ? " approved" : " approve"}`}
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
