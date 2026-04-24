import styles from "./Study.module.css";
import type { StudyCardRecord } from "./types";

type StudyReviewCardProps = {
  card: StudyCardRecord;
  isAnswerVisible: boolean;
  isSuspended?: boolean;
};

export function StudyReviewCard({
  card,
  isAnswerVisible,
  isSuspended = false,
}: StudyReviewCardProps) {
  return (
    <div
      className={`${styles.sessionCard}${isAnswerVisible ? ` ${styles.flipped}` : ""}${isSuspended ? ` ${styles.suspended}` : ""}`}
    >
      <div className={`${styles.sessionCardFace} ${styles.front}`}>
        <span className={styles.sessionCardLabel}>front</span>
        <span className={styles.sessionCardSpace}>{card.spaceName}</span>
        <div className={styles.sessionCardContent}>
          <div
            className={styles.sessionCardText}
            dangerouslySetInnerHTML={{ __html: renderStudyHtml(card.front) }}
          />
        </div>
        {card.tags.length > 0 ? (
          <div className={styles.sessionCardTags}>
            {card.tags.map((tag) => (
              <span className={styles.sessionCardTag} key={`${card.id}-${tag}-front`}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className={`${styles.sessionCardFace} ${styles.back}`}>
        <span className={styles.sessionCardLabel}>back</span>
        <span className={styles.sessionCardSpace}>{card.spaceName}</span>
        <div className={styles.sessionCardContent}>
          <div
            className={styles.sessionCardFrontEcho}
            dangerouslySetInnerHTML={{ __html: renderStudyHtml(card.front) }}
          />
          <div
            className={styles.sessionCardText}
            dangerouslySetInnerHTML={{ __html: renderStudyHtml(card.back) }}
          />
        </div>
        {card.tags.length > 0 ? (
          <div className={styles.sessionCardTags}>
            {card.tags.map((tag) => (
              <span className={styles.sessionCardTag} key={`${card.id}-${tag}-back`}>
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
    .replace(/_____/g, '<span class="session-cloze-blank"></span>')
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
