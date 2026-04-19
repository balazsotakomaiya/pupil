import type { CardRecord } from "../../lib/cards";

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
      <div className="card-list">
        <div className="empty-state">
          <p>No cards match the current filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-list">
      <div className={`card-list-header${mode === "space" ? " space-mode" : ""}`}>
        <span>Front</span>
        <span>State</span>
        <span className="col-source">Source</span>
        <span className="col-due col-right">Due</span>
        {mode === "all" ? <span className="col-space">Space</span> : null}
        <span />
      </div>

      {cards.map((card) => {
        const isExpanded = expandedCardId === card.id;
        const dueMeta = formatDue(card.due);

        return (
          <article
            className={`card-row${isExpanded ? " expanded" : ""}${card.suspended ? " suspended" : ""}`}
            key={card.id}
          >
            <button
              className={`card-row-main${mode === "space" ? " space-mode" : ""}`}
              onClick={() => onToggleExpand(card.id)}
              type="button"
            >
              <span className="card-front">{card.front}</span>
              <span className={`card-state ${stateClassName(card.state)}`}>
                {formatState(card.state)}
              </span>
              <span className="card-source">{formatSource(card.source)}</span>
              <span className={`card-due ${dueMeta.variant === "overdue" ? "overdue" : ""}`}>
                {dueMeta.variant === "overdue" ? <span className="due-dot" /> : null}
                {card.suspended ? "Suspended" : dueMeta.label}
              </span>
              {mode === "all" ? <span className="card-space">{card.spaceName}</span> : null}
              <span className="card-chevron">
                <ChevronIcon />
              </span>
            </button>

            <div className="card-expanded">
              <div className="card-expanded-inner">
                <div className="card-qa">
                  <div className="card-qa-side">
                    <div className="card-qa-label">Front</div>
                    <div className="card-qa-text">{card.front}</div>
                  </div>
                  <div className="card-qa-side">
                    <div className="card-qa-label">Back</div>
                    <div className="card-qa-text back-text">{card.back}</div>
                  </div>
                </div>

                <div className="card-expanded-meta">
                  <span className="meta-item">
                    <strong>{card.spaceName}</strong> space
                  </span>
                  <span className="meta-item">
                    <strong>{formatSource(card.source)}</strong> source
                  </span>
                  <span className="meta-item">
                    <strong>{formatAbsoluteTime(card.updatedAt)}</strong> updated
                  </span>
                  {!card.suspended ? (
                    <span className="meta-item">
                      <strong>{dueMeta.label}</strong> due
                    </span>
                  ) : null}

                  {card.tags.map((tag) => (
                    <span className="tag" key={`${card.id}-${tag}`}>
                      {tag}
                    </span>
                  ))}

                  <div className="card-expanded-actions">
                    <button
                      className="action-btn"
                      onClick={() => onEditCard(card.id)}
                      type="button"
                    >
                      <EditIcon />
                      Edit
                    </button>
                    {onSuspendCard ? (
                      <button
                        className="action-btn"
                        onClick={() => onSuspendCard(card.id, !card.suspended)}
                        type="button"
                      >
                        <SuspendIcon />
                        {card.suspended ? "Unsuspend" : "Suspend"}
                      </button>
                    ) : null}
                    <button
                      className="action-btn"
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
      return "state-learning";
    case 2:
      return "state-review";
    case 3:
      return "state-relearning";
    default:
      return "state-new";
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
