import type { CardRecord } from "../../lib/cards";
import styles from "./Cards.module.css";

type CardListProps = {
  cards: CardRecord[];
  expandedCardId: string | null;
  mode?: "all" | "space";
  onDeleteCard: (cardId: string) => void;
  onEditCard: (cardId: string) => void;
  onSuspendCard?: (cardId: string, suspended: boolean) => void;
  onToggleExpand: (cardId: string) => void;
};

export function CardList({
  cards,
  expandedCardId,
  mode = "all",
  onDeleteCard,
  onEditCard,
  onSuspendCard,
  onToggleExpand,
}: CardListProps) {
  if (cards.length === 0) {
    return (
      <div className={styles.cardList}>
        <div className={styles.emptyState}>
          <p>No cards match the current filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.cardList}>
      <div className={`${styles.cardListHeader}${mode === "space" ? ` ${styles.spaceMode}` : ""}`}>
        <span>Front</span>
        <span>State</span>
        <span className={styles.cardSource}>Source</span>
        <span className={`${styles.cardDue} ${styles.colRight}`}>Due</span>
        {mode === "all" ? <span className={styles.cardSpace}>Space</span> : null}
        <span />
      </div>

      {cards.map((card) => {
        const isExpanded = expandedCardId === card.id;
        const dueMeta = formatDue(card.due);

        return (
          <article
            className={`${styles.cardRow}${isExpanded ? ` ${styles.expanded}` : ""}${card.suspended ? ` ${styles.suspended}` : ""}`}
            key={card.id}
          >
            <button
              className={`${styles.cardRowMain}${mode === "space" ? ` ${styles.spaceMode}` : ""}`}
              onClick={() => onToggleExpand(card.id)}
              type="button"
            >
              <span className={styles.cardFront}>{card.front}</span>
              <span className={`${styles.cardState} ${stateClassName(card.state)}`}>
                {formatState(card.state)}
              </span>
              <span className={styles.cardSource}>{formatSource(card.source)}</span>
              <span
                className={`${styles.cardDue}${dueMeta.variant === "overdue" ? ` ${styles.overdue}` : ""}`}
              >
                {dueMeta.variant === "overdue" ? <span className="due-dot" /> : null}
                {card.suspended ? "Suspended" : dueMeta.label}
              </span>
              {mode === "all" ? <span className={styles.cardSpace}>{card.spaceName}</span> : null}
              <span className={styles.cardChevron}>
                <ChevronIcon />
              </span>
            </button>

            <div className={styles.cardExpanded}>
              <div className={styles.cardExpandedInner}>
                <div className={styles.cardQa}>
                  <div className="card-qa-side">
                    <div className={styles.cardQaLabel}>Front</div>
                    <div className={styles.cardQaText}>{card.front}</div>
                  </div>
                  <div className="card-qa-side">
                    <div className={styles.cardQaLabel}>Back</div>
                    <div className={`${styles.cardQaText} ${styles.backText}`}>{card.back}</div>
                  </div>
                </div>

                <div className={styles.cardExpandedMeta}>
                  <span className={styles.metaItem}>
                    <strong>{card.spaceName}</strong> space
                  </span>
                  <span className={styles.metaItem}>
                    <strong>{formatSource(card.source)}</strong> source
                  </span>
                  <span className={styles.metaItem}>
                    <strong>{formatAbsoluteTime(card.updatedAt)}</strong> updated
                  </span>
                  {!card.suspended ? (
                    <span className={styles.metaItem}>
                      <strong>{dueMeta.label}</strong> due
                    </span>
                  ) : null}

                  {card.tags.map((tag) => (
                    <span className={styles.tag} key={`${card.id}-${tag}`}>
                      {tag}
                    </span>
                  ))}

                  <div className={styles.cardExpandedActions}>
                    <button
                      className={styles.actionBtn}
                      onClick={() => onEditCard(card.id)}
                      type="button"
                    >
                      <EditIcon />
                      Edit
                    </button>
                    {onSuspendCard ? (
                      <button
                        className={styles.actionBtn}
                        onClick={() => onSuspendCard(card.id, !card.suspended)}
                        type="button"
                      >
                        <SuspendIcon />
                        {card.suspended ? "Unsuspend" : "Suspend"}
                      </button>
                    ) : null}
                    <button
                      className={styles.actionBtn}
                      onClick={() => onDeleteCard(card.id)}
                      type="button"
                    >
                      <DeleteIcon />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function formatState(state: number): string {
  switch (state) {
    case 1:
      return "Learning";
    case 2:
      return "Review";
    case 3:
      return "Relearning";
    default:
      return "New";
  }
}

function stateClassName(state: number): string {
  switch (state) {
    case 1:
      return styles.stateLearning;
    case 2:
      return styles.stateReview;
    case 3:
      return styles.stateRelearning;
    default:
      return styles.stateNew;
  }
}

function formatSource(source: CardRecord["source"]): string {
  switch (source) {
    case "ai":
      return "AI";
    case "anki":
      return "Anki";
    default:
      return "Manual";
  }
}

function formatDue(due: number): { label: string; variant: "none" | "overdue" | "upcoming" } {
  const delta = due - Date.now();

  if (delta <= 0) {
    const minutes = Math.max(1, Math.round(Math.abs(delta) / (60 * 1000)));

    if (minutes < 60) {
      return { label: `${minutes}m ago`, variant: "overdue" };
    }

    const hours = Math.round(minutes / 60);

    if (hours < 24) {
      return { label: `${hours}h ago`, variant: "overdue" };
    }

    const days = Math.round(hours / 24);

    return { label: `${days}d ago`, variant: "overdue" };
  }

  const minutes = Math.round(delta / (60 * 1000));

  if (minutes < 60) {
    return { label: `in ${minutes}m`, variant: "upcoming" };
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return { label: `in ${hours}h`, variant: "upcoming" };
  }

  const days = Math.round(hours / 24);

  return { label: `in ${days}d`, variant: "upcoming" };
}

function formatAbsoluteTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(timestamp);
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M7.5 2L10 4.5M2.5 9.5L9 3l-2 5-4.5 1.5z" />
    </svg>
  );
}

function SuspendIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="3" height="8" rx="0.5" />
      <rect x="7" y="2" width="3" height="8" rx="0.5" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M2 3h8M4.5 3V2h3v1M3 3v7.5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V3" />
    </svg>
  );
}
