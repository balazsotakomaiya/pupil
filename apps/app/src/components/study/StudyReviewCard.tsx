import type { StudyCardRecord } from "./types";

type StudyReviewCardProps = {
  card: StudyCardRecord;
  isAnswerVisible: boolean;
};

export function StudyReviewCard({ card, isAnswerVisible }: StudyReviewCardProps) {
  return (
    <div className={`session-card${isAnswerVisible ? " back-showing" : ""}`}>
      <span className="session-card-label">{isAnswerVisible ? "back" : "front"}</span>
      <span className="session-card-space">{card.spaceName}</span>

      <div className="session-card-content">
        {isAnswerVisible ? (
          <>
            <div
              className="session-card-front-echo"
              dangerouslySetInnerHTML={{ __html: renderStudyHtml(card.front) }}
            />
            <div
              className="session-card-text"
              dangerouslySetInnerHTML={{ __html: renderStudyHtml(card.back) }}
            />
          </>
        ) : (
          <div
            className="session-card-text"
            dangerouslySetInnerHTML={{ __html: renderStudyHtml(card.front) }}
          />
        )}
      </div>

      {card.tags.length > 0 ? (
        <div className="session-card-tags">
          {card.tags.map((tag) => (
            <span className="session-card-tag" key={`${card.id}-${tag}`}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
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
