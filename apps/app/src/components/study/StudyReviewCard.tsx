import type { StudyCardRecord } from "./types";

type StudyReviewCardProps = {
  card: StudyCardRecord;
  isAnswerVisible: boolean;
  isSuspended?: boolean;
};

export function StudyReviewCard({ card, isAnswerVisible, isSuspended = false }: StudyReviewCardProps) {
  return (
    <div className={`session-card${isAnswerVisible ? " flipped" : ""}${isSuspended ? " suspended" : ""}`}>
      <div className="session-card-face front">
        <span className="session-card-label">front</span>
        <span className="session-card-space">{card.spaceName}</span>
        <div className="session-card-content">
          <div
            className="session-card-text"
            dangerouslySetInnerHTML={{ __html: renderStudyHtml(card.front) }}
          />
        </div>
        {card.tags.length > 0 ? (
          <div className="session-card-tags">
            {card.tags.map((tag) => (
              <span className="session-card-tag" key={`${card.id}-${tag}-front`}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="session-card-face back">
        <span className="session-card-label">back</span>
        <span className="session-card-space">{card.spaceName}</span>
        <div className="session-card-content">
          <div
            className="session-card-front-echo"
            dangerouslySetInnerHTML={{ __html: renderStudyHtml(card.front) }}
          />
          <div
            className="session-card-text"
            dangerouslySetInnerHTML={{ __html: renderStudyHtml(card.back) }}
          />
        </div>
        {card.tags.length > 0 ? (
          <div className="session-card-tags">
            {card.tags.map((tag) => (
              <span className="session-card-tag" key={`${card.id}-${tag}-back`}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function renderStudyHtml(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(
      /_____/g,
      '<span class="session-cloze-blank"></span>',
    )
    .replace(/\n/g, "<br>");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
