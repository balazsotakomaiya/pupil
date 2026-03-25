import { useEffect, useState } from "react";
import { SpaceDetailsTitlebar } from "../app-shell";
import { CardFormPanel } from "../cards/CardFormPanel";
import { CardList } from "../cards/CardList";
import type { CardRecord } from "../../lib/cards";
import type { SpaceSummary } from "../../lib/spaces";
import type { SpaceStats } from "../../lib/stats";

type CardDraft = {
  back: string;
  front: string;
  spaceId: string;
  tagsText: string;
};

type SpaceDetailsScreenProps = {
  cards: CardRecord[];
  isMutating: boolean;
  onBack: () => void;
  onCreateCard: (input: { back: string; front: string; spaceId: string; tags: string[] }) => Promise<void>;
  onDeleteCard: (input: { id: string }) => Promise<void>;
  onOpenAiGenerate: () => void;
  onStartStudy: () => void;
  stats: SpaceStats | null;
  onUpdateCard: (input: {
    back: string;
    front: string;
    id: string;
    spaceId: string;
    tags: string[];
  }) => Promise<void>;
  space: SpaceSummary;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function SpaceDetailsScreen({
  cards,
  isMutating,
  onBack,
  onCreateCard,
  onDeleteCard,
  onOpenAiGenerate,
  onStartStudy,
  stats,
  onUpdateCard,
  space,
}: SpaceDetailsScreenProps) {
  const [draft, setDraft] = useState<CardDraft>(() => createEmptyDraft(space.id));
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorSuccessPulseTick, setEditorSuccessPulseTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const now = Date.now();

  const spaceCards = cards.filter((card) => card.spaceId === space.id);
  const filteredCards = [...spaceCards]
    .filter((card) => {
      const query = searchQuery.trim().toLowerCase();

      if (!query) {
        return true;
      }

      return `${card.front} ${card.back} ${card.tags.join(" ")}`.toLowerCase().includes(query);
    })
    .sort((left, right) => left.due - right.due || right.updatedAt - left.updatedAt);

  const readyCards = spaceCards.filter((card) => card.due <= now);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = startOfToday.getTime() + DAY_IN_MS;
  const dueTodayCount = spaceCards.filter((card) => card.due < startOfTomorrow).length;
  const overdueCount = spaceCards.filter((card) => card.due < startOfToday.getTime()).length;
  const dueLaterTodayCount = spaceCards.filter((card) => isDueLaterToday(card.due, now)).length;
  const cardsAddedThisWeek = spaceCards.filter((card) => now - card.createdAt < 7 * DAY_IN_MS).length;
  const stateSummary = buildStateSummary(spaceCards);
  const stateRows = buildStateRows(stateSummary);
  const activityBars = buildActivityBars(stats?.reviewActivity7d ?? [], now);
  const recentChanges = [...spaceCards]
    .sort((left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt)
    .slice(0, 5);

  useEffect(() => {
    setDraft((currentDraft) => ({ ...currentDraft, spaceId: space.id }));
  }, [space.id]);

  useEffect(() => {
    if (!editingCardId) {
      return;
    }

    const selectedCard = spaceCards.find((card) => card.id === editingCardId);

    if (!selectedCard) {
      resetDraft(space.id, setDraft, setEditingCardId, setError);
      setIsEditorOpen(false);
    }
  }, [editingCardId, space.id, spaceCards]);

  async function handleSubmit(options: { keepOpen: boolean }) {
    setError(null);

    try {
      const input = {
        back: draft.back,
        front: draft.front,
        spaceId: space.id,
        tags: parseTags(draft.tagsText),
      };

      if (editingCardId) {
        await onUpdateCard({ ...input, id: editingCardId });
      } else {
        await onCreateCard(input);
      }

      resetDraft(space.id, setDraft, setEditingCardId, setError);

      if (editingCardId || !options.keepOpen) {
        setIsEditorOpen(false);
      } else {
        setEditorSuccessPulseTick((currentTick) => currentTick + 1);
      }
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "Failed to save card.");
    }
  }

  async function handleDelete(targetCardId = editingCardId) {
    if (!targetCardId) {
      return;
    }

    setError(null);
    setIsDeleting(true);

    try {
      await onDeleteCard({ id: targetCardId });
      resetDraft(space.id, setDraft, setEditingCardId, setError);
      setExpandedCardId((currentCardId) => (currentCardId === targetCardId ? null : currentCardId));
      setIsEditorOpen(false);
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "Failed to delete card.");
    } finally {
      setIsDeleting(false);
    }
  }

  function handleOpenNewCard() {
    resetDraft(space.id, setDraft, setEditingCardId, setError);
    setIsEditorOpen(true);
  }

  function handleEditCard(cardId: string) {
    const nextCard = spaceCards.find((card) => card.id === cardId);

    if (!nextCard) {
      return;
    }

    setEditingCardId(cardId);
    setExpandedCardId(cardId);
    setIsEditorOpen(true);
    setError(null);
    setDraft({
      back: nextCard.back,
      front: nextCard.front,
      spaceId: space.id,
      tagsText: nextCard.tags.join(", "),
    });
  }

  function handleCloseEditor() {
    if (isMutating || isDeleting) {
      return;
    }

    resetDraft(space.id, setDraft, setEditingCardId, setError);
    setIsEditorOpen(false);
  }

  function handleToggleExpand(cardId: string) {
    setExpandedCardId((currentCardId) => (currentCardId === cardId ? null : cardId));
  }

  return (
    <>
      <SpaceDetailsTitlebar
        onBack={onBack}
        onOpenAiGenerate={onOpenAiGenerate}
        onOpenNewCard={handleOpenNewCard}
        spaceName={space.name}
      />

      <div className="page">
        <section className="space-header">
          <div className="space-header-top">
            <div>
              <h1 className="space-title">{space.name}</h1>
            </div>
          </div>

          <div className="space-tags">
            <span className="space-tag">local space</span>
            <span className="space-tag">created {formatAgeLabel(space.createdAt, now)}</span>
            <span className="space-tag">updated {formatAgeLabel(space.updatedAt, now)}</span>
          </div>

          <p className="space-desc">{buildSpaceDescription(space, readyCards.length, dueLaterTodayCount)}</p>
        </section>

        <section className="study-section">
          <div className="study-card">
            <div className="study-left">
              <div className="study-eyebrow">
                <span className="live-dot" />
                Cards in this space
              </div>
              <div className="study-headline">{buildStudyHeadline(readyCards.length, space.cardCount)}</div>
              <div className="study-sub">
                {buildStudySubline(readyCards.length, dueLaterTodayCount, spaceCards, now)}
              </div>
            </div>

            <div className="study-right">
              <button className="study-btn-secondary" onClick={onBack} type="button">
                Dashboard
              </button>
              <button className="study-btn" onClick={onStartStudy} type="button">
                Study this space →
              </button>
            </div>
          </div>
        </section>

        <div className="ruler-divider" />

        <section className="section">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-eyebrow">Cards</div>
              <div className="stat-value">{formatNumber(space.cardCount)}</div>
              <div className="stat-sub">
                {cardsAddedThisWeek > 0 ? (
                  <>
                    <span className="up">↑ {formatNumber(cardsAddedThisWeek)}</span> this week
                  </>
                ) : (
                  "No new cards this week"
                )}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-eyebrow">Due today</div>
              <div className="stat-value">{formatNumber(dueTodayCount)}</div>
              <div className="stat-sub">
                {overdueCount > 0
                  ? `${formatNumber(overdueCount)} overdue`
                  : dueTodayCount > 0
                    ? "Nothing overdue"
                    : "Nothing scheduled today"}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-eyebrow">Retention</div>
              <div className="stat-value">
                {stats?.retention30d !== null && stats?.retention30d !== undefined
                  ? Math.round(stats.retention30d)
                  : "—"}
                {stats?.retention30d !== null && stats?.retention30d !== undefined ? (
                  <span className="unit">%</span>
                ) : null}
              </div>
              <div className="stat-sub">
                {stats?.retention30d !== null && stats?.retention30d !== undefined
                  ? "Good or Easy in the last 30 days"
                  : "No review history yet"}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-eyebrow">Streak</div>
              <div className="stat-value">
                {formatNumber(space.streak)}
                <span className="unit">days</span>
              </div>
              <div className="stat-sub">
                {space.streak > 0 ? "Current space streak" : "No streak yet"}
              </div>
            </div>
          </div>
        </section>

        <div className="ruler-divider" />

        <section className="section">
          <div className="charts-grid">
            <div className="chart-card">
              <div className="chart-header">
                <span className="chart-title">Review activity</span>
                <span className="chart-period">last 7 days</span>
              </div>

              <div className="bar-chart">
                {activityBars.map((bar) => (
                  <div className="bar-col" key={bar.label}>
                    <div
                      className={`bar${bar.isToday ? " today" : ""}`}
                      style={{ height: `${bar.height}%` }}
                      title={`${bar.count} reviews`}
                    />
                    <span className="bar-label">{bar.label}</span>
                  </div>
                ))}
              </div>

              <div className="chart-axis">
                <span>0</span>
                <span>{formatNumber(activityBars.reduce((max, bar) => Math.max(max, bar.count), 0))}</span>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-header">
                <span className="chart-title">Card states</span>
                <span className="chart-period">{formatNumber(space.cardCount)} total</span>
              </div>

              <div className="state-breakdown">
                <div className="state-bar-visual">
                  {stateRows.map((state) =>
                    state.count > 0 ? (
                      <div
                        className={`state-segment ${state.className}`}
                        key={state.key}
                        style={{ width: `${state.percentage}%` }}
                        title={`${state.label}: ${state.count}`}
                      />
                    ) : null,
                  )}
                </div>

                <div className="state-legend">
                  {stateRows.map((state) => (
                    <div className="state-row" key={`legend-${state.key}`}>
                      <div className="state-row-left">
                        <span className={`state-dot ${state.className}`} />
                        <span className="state-name">{state.label}</span>
                      </div>
                      <div className="state-row-right">
                        <span className="state-count">{formatNumber(state.count)}</span>
                        <span className="state-pct">{Math.round(state.percentage)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="ruler-divider" />

        <section className="section">
          <div className="section-head">
            <span className="section-label">Recent activity</span>
          </div>

          {recentChanges.length > 0 ? (
            <div className="reviews-table">
              <div className="reviews-header">
                <span>Front</span>
                <span>Status</span>
                <span>Source</span>
                <span className="col-right">Updated</span>
              </div>

              {recentChanges.map((card) => (
                <div className="review-row" key={`change-${card.id}`}>
                  <span className="review-front">{card.front}</span>
                  <span className={`review-grade ${stateClassName(card.state)}`}>
                    {formatState(card.state)}
                  </span>
                  <span className="review-interval">{formatSource(card.source)}</span>
                  <span className="review-time">{formatRelativeTime(card.updatedAt, now)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="placeholder-panel detail-empty">
              <p>No card activity in this space yet.</p>
            </div>
          )}
        </section>

        <div className="ruler-divider" />

        <section className="section">
          <div className="section-head">
            <span className="section-label">Cards</span>
            <div className="toolbar-top-right">
              <button className="btn-ghost" onClick={handleOpenNewCard} type="button">
                <PlusIcon />
                New Card
              </button>
              <button className="btn-ghost" onClick={onOpenAiGenerate} type="button">
                <GenerateIcon />
                AI Generate
              </button>
            </div>
          </div>

          <div className="search-compact">
            <SearchIcon />
            <input
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search this space by front, back, or tags..."
              value={searchQuery}
            />
          </div>

          <CardList
            cards={filteredCards}
            expandedCardId={expandedCardId}
            mode="space"
            onDeleteCard={(cardId) => void handleDelete(cardId)}
            onEditCard={handleEditCard}
            onToggleExpand={handleToggleExpand}
          />
        </section>

        <div className="page-end" />
      </div>

      <CardFormPanel
        draft={draft}
        error={error}
        hasSelectedCard={editingCardId !== null}
        isDeleting={isDeleting}
        isOpen={isEditorOpen}
        isSubmitting={isMutating}
        onChange={(patch) => setDraft((currentDraft) => ({ ...currentDraft, ...patch, spaceId: space.id }))}
        onClose={handleCloseEditor}
        onDelete={handleDelete}
        onSubmit={(options) => void handleSubmit(options)}
        successPulseTick={editorSuccessPulseTick}
        spaces={[space]}
      />
    </>
  );
}

function buildStudyHeadline(readyCount: number, totalCount: number): string {
  if (readyCount > 0) {
    return `${formatNumber(readyCount)} cards ready to review`;
  }

  if (totalCount === 0) {
    return "No cards in this space yet";
  }

  return "Nothing ready to review right now";
}

function buildStudySubline(
  readyCount: number,
  dueLaterTodayCount: number,
  cards: CardRecord[],
  now: number,
): string {
  if (cards.length === 0) {
    return "Start this space by adding a few focused cards, then come back here to review and track progress.";
  }

  const nextUpcomingCard = [...cards]
    .filter((card) => card.due > now)
    .sort((left, right) => left.due - right.due)[0];

  const rangeLabel = nextUpcomingCard
    ? `Next card ${formatUpcomingDue(nextUpcomingCard.due, now)}.`
    : "Everything currently scheduled is already available.";

  if (readyCount > 0) {
    return dueLaterTodayCount > 0
      ? `${formatNumber(readyCount)} available now, ${formatNumber(dueLaterTodayCount)} more later today. ${rangeLabel}`
      : `${formatNumber(readyCount)} available now. ${rangeLabel}`;
  }

  return dueLaterTodayCount > 0
    ? `${formatNumber(dueLaterTodayCount)} cards arrive later today. ${rangeLabel}`
    : rangeLabel;
}

function buildSpaceDescription(
  space: SpaceSummary,
  readyCount: number,
  dueLaterTodayCount: number,
): string {
  if (space.cardCount === 0) {
    return "No cards in this space yet. Add a focused set of prompts to start scheduling reviews here.";
  }

  if (readyCount === 0 && dueLaterTodayCount === 0) {
    return `${formatCount(space.cardCount, "card")} loaded. This space is fully caught up for now.`;
  }

  return `${formatCount(space.cardCount, "card")} loaded with ${formatNumber(readyCount)} ready now and ${formatNumber(dueLaterTodayCount)} more scheduled later today.`;
}

function buildActivityBars(counts: number[], now: number) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(startOfToday);
    day.setDate(startOfToday.getDate() - (6 - index));
    const count = counts[index] ?? 0;

    return {
      count,
      isToday: index === 6,
      label: day.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1),
    };
  });

  const maxCount = Math.max(...days.map((day) => day.count), 1);

  return days.map((day) => ({
    ...day,
    height: Math.max(2, Math.round((day.count / maxCount) * 100)),
  }));
}

function buildStateSummary(cards: CardRecord[]) {
  return {
    learning: { count: cards.filter((card) => card.state === 1).length },
    new: { count: cards.filter((card) => card.state === 0).length },
    relearning: { count: cards.filter((card) => card.state === 3).length },
    review: { count: cards.filter((card) => card.state === 2).length },
  };
}

function buildStateRows(summary: ReturnType<typeof buildStateSummary>) {
  const totalCount =
    summary.new.count + summary.learning.count + summary.review.count + summary.relearning.count;

  return [
    {
      className: "clr-new",
      count: summary.new.count,
      key: "new",
      label: "New",
      percentage: totalCount > 0 ? (summary.new.count / totalCount) * 100 : 0,
    },
    {
      className: "clr-learning",
      count: summary.learning.count,
      key: "learning",
      label: "Learning",
      percentage: totalCount > 0 ? (summary.learning.count / totalCount) * 100 : 0,
    },
    {
      className: "clr-review",
      count: summary.review.count,
      key: "review",
      label: "Review",
      percentage: totalCount > 0 ? (summary.review.count / totalCount) * 100 : 0,
    },
    {
      className: "clr-relearning",
      count: summary.relearning.count,
      key: "relearning",
      label: "Relearning",
      percentage: totalCount > 0 ? (summary.relearning.count / totalCount) * 100 : 0,
    },
  ];
}

function createEmptyDraft(spaceId: string): CardDraft {
  return {
    back: "",
    front: "",
    spaceId,
    tagsText: "",
  };
}

function parseTags(tagsText: string): string[] {
  return tagsText
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag, index, allTags) => tag.length > 0 && allTags.indexOf(tag) === index);
}

function resetDraft(
  spaceId: string,
  setDraft: (value: CardDraft) => void,
  setEditingCardId: (value: string | null) => void,
  setError: (value: string | null) => void,
) {
  setEditingCardId(null);
  setError(null);
  setDraft(createEmptyDraft(spaceId));
}

function isDueLaterToday(due: number, now: number): boolean {
  if (due <= now) {
    return false;
  }

  const dueDate = new Date(due);
  const currentDate = new Date(now);

  return (
    dueDate.getFullYear() === currentDate.getFullYear() &&
    dueDate.getMonth() === currentDate.getMonth() &&
    dueDate.getDate() === currentDate.getDate()
  );
}

function formatCount(value: number, label: string): string {
  return `${formatNumber(value)} ${label}${value === 1 ? "" : "s"}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatAgeLabel(timestamp: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - timestamp) / (60 * 1000)));

  if (minutes < 60) {
    return minutes <= 1 ? "just now" : `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.floor(days / 7);

  if (weeks < 5) {
    return `${weeks}w ago`;
  }

  const months = Math.floor(days / 30);

  return `${months}mo ago`;
}

function formatRelativeTime(timestamp: number, now: number): string {
  return formatAgeLabel(timestamp, now);
}

function formatUpcomingDue(due: number, now: number): string {
  const delta = due - now;
  const minutes = Math.round(delta / (60 * 1000));

  if (minutes < 60) {
    return `in ${Math.max(1, minutes)}m`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `in ${hours}h`;
  }

  const days = Math.round(hours / 24);

  return `in ${days}d`;
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 2v10M2 7h10" />
    </svg>
  );
}

function GenerateIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4">
      <path d="M8 1.75l.8 2.6a1 1 0 00.67.67l2.6.8-2.6.8a1 1 0 00-.67.67L8 10.9l-.8-2.61a1 1 0 00-.67-.67l-2.6-.8 2.6-.8a1 1 0 00.67-.67L8 1.75z" />
      <path d="M12.75 9.75l.39 1.29a.7.7 0 00.47.47l1.29.39-1.29.39a.7.7 0 00-.47.47l-.39 1.29-.39-1.29a.7.7 0 00-.47-.47l-1.29-.39 1.29-.39a.7.7 0 00.47-.47l.39-1.29z" />
      <path d="M3 10.75l.3.99a.6.6 0 00.4.4l.99.3-.99.3a.6.6 0 00-.4.4L3 14.13l-.3-.99a.6.6 0 00-.4-.4l-.99-.3.99-.3a.6.6 0 00.4-.4l.3-.99z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  );
}
