import { useEffect, useRef, useState } from "react";
import type { CardRecord } from "../../lib/cards";
import { toAppError } from "../../lib/errors";
import type { SpaceSummary } from "../../lib/spaces";
import { GridIcon } from "../icons/GridIcon";
import { PlusIcon } from "../icons/PlusIcon";
import { SearchIcon } from "../icons/SearchIcon";
import { SortIcon } from "../icons/SortIcon";
import { Pagination } from "../Pagination";
import { CardFormPanel } from "./CardFormPanel";
import { CardList } from "./CardList";
import styles from "./Cards.module.css";
import { CARD_SORT_OPTIONS, type CardSortMode, sortCardsForList } from "./cardSort";

const PAGE_SIZE = 50;

type CardDraft = {
  back: string;
  front: string;
  spaceId: string;
  tagsText: string;
};

type CardsScreenProps = {
  actionableDueCount: number;
  cards: CardRecord[];
  isMutating: boolean;
  onCreateCard: (input: {
    back: string;
    front: string;
    spaceId: string;
    tags: string[];
  }) => Promise<void>;
  onDeleteCard: (input: { id: string }) => Promise<void>;
  onOpenCreateDialog: () => void;
  onSuspendCard: (input: { id: string; suspended: boolean }) => Promise<CardRecord>;
  onUpdateCard: (input: {
    back: string;
    front: string;
    id: string;
    spaceId: string;
    tags: string[];
  }) => Promise<void>;
  spaces: SpaceSummary[];
};

const EMPTY_DRAFT: CardDraft = {
  back: "",
  front: "",
  spaceId: "",
  tagsText: "",
};

export function CardsScreen({
  actionableDueCount,
  cards,
  isMutating,
  onCreateCard,
  onDeleteCard,
  onOpenCreateDialog,
  onSuspendCard,
  onUpdateCard,
  spaces,
}: CardsScreenProps) {
  const [draft, setDraft] = useState<CardDraft>(EMPTY_DRAFT);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorSuccessPulseTick, setEditorSuccessPulseTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | number>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | CardRecord["source"]>("all");
  const [spaceFilter, setSpaceFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<CardSortMode>("due");
  const [currentPage, setCurrentPage] = useState(1);
  const cardListSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (spaces.length === 0) {
      setDraft(EMPTY_DRAFT);
      setEditingCardId(null);
      setExpandedCardId(null);
      setIsEditorOpen(false);
      return;
    }

    setDraft((currentDraft) => {
      if (currentDraft.spaceId) {
        return currentDraft;
      }

      return { ...currentDraft, spaceId: spaces[0].id };
    });
  }, [spaces]);

  useEffect(() => {
    if (!editingCardId) {
      return;
    }

    const selectedCard = cards.find((card) => card.id === editingCardId);

    if (!selectedCard) {
      resetDraft(spaces, setDraft, setEditingCardId, setError);
      setIsEditorOpen(false);
    }
  }, [cards, editingCardId, spaces]);

  const filteredCards = sortCardsForList(
    cards.filter((card) => {
      const query = searchQuery.trim().toLowerCase();

      if (
        query &&
        !`${card.front} ${card.back} ${card.tags.join(" ")}`.toLowerCase().includes(query)
      ) {
        return false;
      }

      if (stateFilter !== "all" && card.state !== stateFilter) {
        return false;
      }

      if (sourceFilter !== "all" && card.source !== sourceFilter) {
        return false;
      }

      if (spaceFilter !== "all" && card.spaceId !== spaceFilter) {
        return false;
      }

      return true;
    }),
    sortMode,
  );

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedCards = filteredCards.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
    setExpandedCardId(null);
  }, [searchQuery, stateFilter, sourceFilter, spaceFilter, sortMode]);

  if (spaces.length === 0) {
    return (
      <div className={`page ${styles.cardsPage}`}>
        <section className="section">
          <div className="placeholder-panel">
            <span className="section-label">Manual cards</span>
            <h2>Create a space before adding cards</h2>
            <p>
              Cards belong to spaces. Start by creating a topic or subject space, then use the
              manual card editor to build your first deck.
            </p>
            <button className="study-btn" onClick={onOpenCreateDialog} type="button">
              New Space
            </button>
          </div>
        </section>
      </div>
    );
  }

  async function handleSubmit(options: { keepOpen: boolean }) {
    setError(null);

    try {
      const input = {
        back: draft.back,
        front: draft.front,
        spaceId: draft.spaceId,
        tags: parseTags(draft.tagsText),
      };

      if (editingCardId) {
        await onUpdateCard({ ...input, id: editingCardId });
      } else {
        await onCreateCard(input);
      }

      resetDraft(spaces, setDraft, setEditingCardId, setError);

      if (editingCardId || !options.keepOpen) {
        setIsEditorOpen(false);
      } else {
        setEditorSuccessPulseTick((currentTick) => currentTick + 1);
      }
    } catch (nextError: unknown) {
      setError(toAppError(nextError, "Failed to save card.").message);
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
      resetDraft(spaces, setDraft, setEditingCardId, setError);
      setExpandedCardId((currentCardId) => (currentCardId === targetCardId ? null : currentCardId));
      setIsEditorOpen(false);
    } catch (nextError: unknown) {
      setError(toAppError(nextError, "Failed to delete card.").message);
    } finally {
      setIsDeleting(false);
    }
  }

  function handleOpenNewCard() {
    resetDraft(spaces, setDraft, setEditingCardId, setError);
    setIsEditorOpen(true);
  }

  function handleEditCard(cardId: string) {
    const nextCard = cards.find((card) => card.id === cardId);

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
      spaceId: nextCard.spaceId,
      tagsText: nextCard.tags.join(", "),
    });
  }

  function handleCloseEditor() {
    if (isMutating || isDeleting) {
      return;
    }

    resetDraft(spaces, setDraft, setEditingCardId, setError);
    setIsEditorOpen(false);
  }

  function handleToggleExpand(cardId: string) {
    setExpandedCardId((currentCardId) => (currentCardId === cardId ? null : cardId));
  }

  function handlePageChange(page: number) {
    setCurrentPage(page);
    window.requestAnimationFrame(() => {
      cardListSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className={`page ${styles.cardsPage}`}>
      <section className={styles.toolbarSection}>
        <div className={styles.toolbarTop}>
          <div className={styles.toolbarTopLeft}>
            <span className="section-label">All Cards</span>
            <span className={styles.cardCount}>
              <strong>{cards.length}</strong> cards · <strong>{actionableDueCount}</strong> due
            </span>
          </div>
          <div className={styles.toolbarTopRight}>
            <button className="btn-ghost" onClick={handleOpenNewCard} type="button">
              <PlusIcon />
              New Card
            </button>
          </div>
        </div>

        <div className={styles.searchRow}>
          <div className={styles.searchInputWrap}>
            <SearchIcon />
            <input
              className={styles.searchInput}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search cards by front, back, or tags..."
              value={searchQuery}
            />
          </div>
          <label className={styles.sortSelectWrap}>
            <SortIcon />
            <span className={styles.sortSelectLabel}>Sort</span>
            <select
              className={styles.sortSelect}
              onChange={(event) => setSortMode(event.target.value as CardSortMode)}
              value={sortMode}
            >
              {CARD_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.filterRow}>
          {buildStateFilters(cards).map((filter) => (
            <button
              className={`${styles.filterChip}${stateFilter === filter.value ? ` ${styles.active}` : ""}`}
              key={filter.label}
              onClick={() => setStateFilter(filter.value)}
              type="button"
            >
              {filter.label}
              {filter.count !== null ? (
                <span className={styles.chipCount}>{filter.count}</span>
              ) : null}
            </button>
          ))}

          <div className={styles.filterSep} />

          {buildSourceFilters(cards).map((filter) => (
            <button
              className={`${styles.filterChip}${sourceFilter === filter.value ? ` ${styles.active}` : ""}`}
              key={filter.label}
              onClick={() =>
                setSourceFilter((currentFilter) =>
                  currentFilter === filter.value ? "all" : filter.value,
                )
              }
              type="button"
            >
              {filter.label}
              <span className={styles.chipCount}>{filter.count}</span>
            </button>
          ))}

          <div className={styles.filterSep} />

          <label className={styles.spaceFilterChip}>
            <GridIcon />
            <select
              className={styles.spaceFilterSelect}
              onChange={(event) => setSpaceFilter(event.target.value)}
              value={spaceFilter}
            >
              <option value="all">All spaces</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="ruler-divider" />

      <section className={styles.cardListSection} ref={cardListSectionRef}>
        <CardList
          cards={paginatedCards}
          expandedCardId={expandedCardId}
          onDeleteCard={(cardId) => void handleDelete(cardId)}
          onEditCard={handleEditCard}
          onSuspendCard={(cardId, suspended) => void onSuspendCard({ id: cardId, suspended })}
          onToggleExpand={handleToggleExpand}
        />
        <Pagination
          currentPage={safePage}
          onPageChange={handlePageChange}
          totalPages={totalPages}
        />
      </section>

      <div className="page-end" />

      <CardFormPanel
        draft={draft}
        error={error}
        hasSelectedCard={editingCardId !== null}
        isDeleting={isDeleting}
        isOpen={isEditorOpen}
        isSubmitting={isMutating}
        onChange={(patch) => setDraft((currentDraft) => ({ ...currentDraft, ...patch }))}
        onClose={handleCloseEditor}
        onDelete={handleDelete}
        onSubmit={(options) => void handleSubmit(options)}
        successPulseTick={editorSuccessPulseTick}
        spaces={spaces}
      />
    </div>
  );
}

function buildStateFilters(cards: CardRecord[]) {
  return [
    { label: "All", value: "all" as const, count: null },
    { label: "New", value: 0 as const, count: cards.filter((card) => card.state === 0).length },
    {
      label: "Learning",
      value: 1 as const,
      count: cards.filter((card) => card.state === 1).length,
    },
    { label: "Review", value: 2 as const, count: cards.filter((card) => card.state === 2).length },
    {
      label: "Relearning",
      value: 3 as const,
      count: cards.filter((card) => card.state === 3).length,
    },
  ];
}

function buildSourceFilters(cards: CardRecord[]) {
  return [
    {
      label: "Manual",
      value: "manual" as const,
      count: cards.filter((card) => card.source === "manual").length,
    },
    {
      label: "AI",
      value: "ai" as const,
      count: cards.filter((card) => card.source === "ai").length,
    },
    {
      label: "Anki",
      value: "anki" as const,
      count: cards.filter((card) => card.source === "anki").length,
    },
  ];
}

function parseTags(tagsText: string): string[] {
  return tagsText
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag, index, allTags) => tag.length > 0 && allTags.indexOf(tag) === index);
}

function resetDraft(
  spaces: SpaceSummary[],
  setDraft: (value: CardDraft) => void,
  setEditingCardId: (value: string | null) => void,
  setError: (value: string | null) => void,
) {
  setEditingCardId(null);
  setError(null);
  setDraft({
    ...EMPTY_DRAFT,
    spaceId: spaces[0]?.id ?? "",
  });
}
