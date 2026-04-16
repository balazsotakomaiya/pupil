import { useEffect, useMemo, useState } from "react";
import { previewCardScheduling } from "../../lib/fsrs";
import type { CardRecord } from "../../lib/cards";
import type { SpaceSummary } from "../../lib/spaces";
import { StudyActions } from "./StudyActions";
import { StudyBar } from "./StudyBar";
import { StudyReviewCard } from "./StudyReviewCard";
import { StudySummary } from "./StudySummary";
import type { StudyCardRecord, StudyGrade, StudyScope } from "./types";

type StudyScreenProps = {
  cards: StudyCardRecord[];
  newCardsBudget: number | null;
  onBack: () => void;
  onDeleteCard: (input: { id: string }) => Promise<void>;
  onReviewCard: (input: { card: CardRecord; grade: StudyGrade }) => Promise<CardRecord>;
  onSuspendCard: (input: { id: string; suspended: boolean }) => Promise<CardRecord>;
  sessionKey: number;
  scope: StudyScope;
  scopeLabel: string;
  space?: SpaceSummary | null;
};

export function StudyScreen({
  cards,
  newCardsBudget,
  onBack,
  onDeleteCard,
  onReviewCard,
  onSuspendCard,
  sessionKey,
  scope,
  scopeLabel,
  space = null,
}: StudyScreenProps) {
  const [sessionCards, setSessionCards] = useState<StudyCardRecord[]>(() => cards);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [pressedGrade, setPressedGrade] = useState<StudyGrade | null>(null);
  const [sessionGrades, setSessionGrades] = useState<StudyGrade[]>([]);
  const [sessionNewCardsBudget] = useState(() => newCardsBudget);
  const [sessionCardIds, setSessionCardIds] = useState<Set<string>>(() =>
    buildAdmittedSet(cards, Date.now(), newCardsBudget),
  );
  const [isSummaryVisible, setIsSummaryVisible] = useState(
    () => buildDueQueue(cards, Date.now()).filter((c) => buildAdmittedSet(cards, Date.now(), newCardsBudget).has(c.id)).length === 0,
  );
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // When a card is suspended mid-session we keep it visible so the user can
  // choose to skip or immediately unsuspend — rather than advancing silently.
  const [suspendedCardId, setSuspendedCardId] = useState<string | null>(null);

  const queue = useMemo(
    () => buildDueQueue(sessionCards, now).filter((card) => sessionCardIds.has(card.id)),
    [sessionCards, now, sessionCardIds],
  );
  const currentCard = queue[0] ?? null;
  const isSuspendedView = !!suspendedCardId;
  // While showing a just-suspended card, keep it in the display even though
  // it has been removed from the due queue.
  const displayCard = suspendedCardId
    ? (sessionCards.find((c) => c.id === suspendedCardId) ?? null)
    : currentCard;
  const reviewedCount = sessionGrades.length;
  const totalCards = queue.length + reviewedCount;
  const currentCounter = queue.length === 0 ? reviewedCount : reviewedCount + 1;
  const progress =
    isSummaryVisible || totalCards === 0 ? (isSummaryVisible ? 100 : 0) : (reviewedCount / totalCards) * 100;
  const retention =
    sessionGrades.length > 0
      ? Math.round((sessionGrades.filter((grade) => grade >= 3).length / sessionGrades.length) * 100)
      : 0;
  const totalMinutes = Math.max(1, Math.round((Date.now() - startedAt) / (60 * 1000)));
  const nextDueLabel = buildNextDueLabel(sessionCards, now);
  const summaryTitle = reviewedCount === 0 && queue.length === 0 ? "No cards due" : "Session complete";
  const allDueCards = buildDueQueue(sessionCards, now);
  const gatedNewCards = allDueCards.filter((c) => c.state === 0 && !sessionCardIds.has(c.id));
  const hasGatedNewCards = newCardsBudget !== null && gatedNewCards.length > 0;
  const summarySubtitle =
    reviewedCount === 0 && queue.length === 0
      ? hasGatedNewCards
        ? `You've hit your daily limit of ${sessionNewCardsBudget} new cards. Reviews of cards already in your queue will still appear when due.`
        : `Nothing is due in ${scopeLabel} right now. Come back when the next review window opens.`
      : hasGatedNewCards
        ? `You reviewed ${reviewedCount} card${reviewedCount === 1 ? "" : "s"} in ${scopeLabel}. ${gatedNewCards.length} new card${gatedNewCards.length === 1 ? "" : "s"} held back by your daily new-card limit.`
        : `You reviewed ${reviewedCount} due card${reviewedCount === 1 ? "" : "s"} in ${scopeLabel}.`;
  const streakLabel =
    scope === "space"
      ? `${Math.max(space?.streak ?? 0, reviewedCount > 0 ? 1 : 0)} day streak in ${scopeLabel}`
      : `${Math.max(space?.streak ?? 0, reviewedCount > 0 ? 1 : 0)} day study streak`;
  const backLabel = scope === "space" ? "Back to space →" : "Back to dashboard →";
  const intervalPreviews = currentCard ? previewCardScheduling(currentCard, now) : [];

  useEffect(() => {
    setSessionCards(cards);
    setIsAnswerVisible(false);
    setPressedGrade(null);
    setSessionGrades([]);
    const admitted = buildAdmittedSet(cards, Date.now(), newCardsBudget);
    setSessionCardIds(admitted);
    setIsSummaryVisible(buildDueQueue(cards, Date.now()).filter((c) => admitted.has(c.id)).length === 0);
    setStartedAt(Date.now());
    setIsSubmittingReview(false);
    setError(null);
    setNow(Date.now());
    setSuspendedCardId(null);
  }, [scope, scopeLabel, sessionKey]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isSummaryVisible) {
        if (event.code === "Escape") {
          event.preventDefault();
          onBack();
        }

        return;
      }

      if (event.code === "Space" && !isAnswerVisible && !isSubmittingReview && !isSuspendedView) {
        event.preventDefault();
        setIsAnswerVisible(true);
      }

      if (!isAnswerVisible || pressedGrade !== null || isSubmittingReview) {
        if (event.code === "Escape") {
          event.preventDefault();
          setIsSummaryVisible(true);
        }

        return;
      }

      if (event.code === "Escape") {
        event.preventDefault();
        setIsSummaryVisible(true);
        return;
      }

      const mapping: Record<string, StudyGrade> = {
        Digit1: 1,
        Digit2: 2,
        Digit3: 3,
        Digit4: 4,
      };

      const grade = mapping[event.code];

      if (grade) {
        event.preventDefault();
        handleRate(grade);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAnswerVisible, isSubmittingReview, isSummaryVisible, isSuspendedView, onBack, pressedGrade]);

  async function handleRate(grade: StudyGrade) {
    if (!currentCard || pressedGrade !== null || isSubmittingReview) {
      return;
    }

    setPressedGrade(grade);
    setIsSubmittingReview(true);
    setError(null);

    try {
      const updatedCard = await onReviewCard({ card: currentCard, grade });
      const nextCards = sessionCards.map((card) => (card.id === updatedCard.id ? updatedCard : card));
      const nextNow = updatedCard.lastReview ?? Date.now();

      setSessionGrades((currentGrades) => [...currentGrades, grade]);
      setSessionCards(nextCards);
      setIsAnswerVisible(false);
      setNow(nextNow);

      if (buildDueQueue(nextCards, nextNow).filter((card) => sessionCardIds.has(card.id)).length === 0) {
        setIsSummaryVisible(true);
      }
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "Failed to save review.");
    } finally {
      setPressedGrade(null);
      setIsSubmittingReview(false);
    }
  }

  async function handleQuickDelete() {
    if (!currentCard || isSubmittingReview) {
      return;
    }

    setError(null);

    try {
      await onDeleteCard({ id: currentCard.id });
      const nextCards = sessionCards.filter((card) => card.id !== currentCard.id);
      const nextNow = Date.now();
      setSessionCards(nextCards);
      setIsAnswerVisible(false);
      setNow(nextNow);

      if (buildDueQueue(nextCards, nextNow).filter((card) => sessionCardIds.has(card.id)).length === 0) {
        setIsSummaryVisible(true);
      }
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "Failed to delete card.");
    }
  }

  async function handleQuickSuspend() {
    if (!currentCard || isSubmittingReview) {
      return;
    }

    setError(null);

    try {
      const updatedCard = await onSuspendCard({ id: currentCard.id, suspended: true });
      const nextCards = sessionCards.map((card) => (card.id === updatedCard.id ? updatedCard : card));
      setSessionCards(nextCards);
      // Keep the card visible so the user can decide to skip or unsuspend.
      setSuspendedCardId(currentCard.id);
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "Failed to suspend card.");
    }
  }

  async function handleUnsuspend() {
    if (!suspendedCardId || isSubmittingReview) {
      return;
    }

    setError(null);

    try {
      const updatedCard = await onSuspendCard({ id: suspendedCardId, suspended: false });
      const nextCards = sessionCards.map((card) => (card.id === updatedCard.id ? updatedCard : card));
      setSessionCards(nextCards);
      setSuspendedCardId(null);
      setNow(Date.now());
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "Failed to unsuspend card.");
    }
  }

  function handleSkipSuspended() {
    setSuspendedCardId(null);
    setIsAnswerVisible(false);
    setPressedGrade(null);
    const nextNow = Date.now();
    setNow(nextNow);

    if (buildDueQueue(sessionCards, nextNow).filter((card) => sessionCardIds.has(card.id)).length === 0) {
      setIsSummaryVisible(true);
    }
  }

  function handleRestart() {
    const admitted = buildAdmittedSet(sessionCards, Date.now(), sessionNewCardsBudget);
    setSessionCardIds(admitted);
    setIsAnswerVisible(false);
    setPressedGrade(null);
    setSessionGrades([]);
    setIsSummaryVisible(buildDueQueue(sessionCards, Date.now()).filter((c) => admitted.has(c.id)).length === 0);
    setStartedAt(Date.now());
    setIsSubmittingReview(false);
    setError(null);
    setNow(Date.now());
  }

  return (
    <div className="session-shell">
      <StudyBar
        current={currentCounter}
        currentCard={currentCard}
        isSuspended={isSuspendedView}
        onDeleteCard={() => void handleQuickDelete()}
        onEnd={() => setIsSummaryVisible(true)}
        onSuspendCard={() => void handleQuickSuspend()}
        scopeLabel={scopeLabel}
        total={totalCards}
      />

      <div className="session-progress-track">
        <div className="session-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {isSummaryVisible ? (
        <StudySummary
          backLabel={backLabel}
          nextDueLabel={nextDueLabel}
          onBack={onBack}
          onRestart={handleRestart}
          retention={retention}
          reviewedCount={reviewedCount}
          streakLabel={streakLabel}
          subtitle={summarySubtitle}
          title={summaryTitle}
          totalMinutes={totalMinutes}
        />
      ) : displayCard ? (
        <div className="session-area">
          <div className="session-card-wrap">
            <StudyReviewCard card={displayCard} isAnswerVisible={isAnswerVisible} isSuspended={isSuspendedView} />
          </div>

          {isSuspendedView ? (
            <div className="session-suspended-actions">
              <p className="session-suspended-label">Card suspended</p>
              <div className="session-suspended-btns">
                <button
                  className="session-unsuspend-btn"
                  disabled={isSubmittingReview}
                  onClick={() => void handleUnsuspend()}
                  type="button"
                >
                  Unsuspend
                </button>
                <button
                  className="session-skip-btn"
                  disabled={isSubmittingReview}
                  onClick={handleSkipSuspended}
                  type="button"
                >
                  Skip
                </button>
              </div>
              {error ? <span className="session-error-text">{error}</span> : null}
            </div>
          ) : (
            <StudyActions
              error={error}
              intervalPreviews={intervalPreviews}
              isAnswerVisible={isAnswerVisible}
              isSubmitting={isSubmittingReview}
              onRate={(grade) => void handleRate(grade)}
              onReveal={() => setIsAnswerVisible(true)}
              pressedGrade={pressedGrade}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

function buildDueQueue(cards: StudyCardRecord[], now: number) {
  return [...cards]
    .filter((card) => card.due <= now && !card.suspended)
    .sort((left, right) => left.due - right.due || right.updatedAt - left.updatedAt);
}

/**
 * Build the set of card IDs admitted into a session.
 * - All due review cards (state > 0) are always admitted.
 * - New cards (state === 0) are admitted up to `newCardsBudget`.
 */
function buildAdmittedSet(
  cards: StudyCardRecord[],
  now: number,
  newCardsBudget: number | null,
): Set<string> {
  const dueCards = buildDueQueue(cards, now);
  const reviewCards = dueCards.filter((c) => c.state > 0);
  const newCards = dueCards.filter((c) => c.state === 0);
  const admittedNewCards =
    newCardsBudget !== null ? newCards.slice(0, newCardsBudget) : newCards;

  return new Set([...reviewCards, ...admittedNewCards].map((c) => c.id));
}

function buildNextDueLabel(cards: StudyCardRecord[], now: number): string {
  const nextDue = [...cards]
    .filter((card) => card.due > now)
    .sort((left, right) => left.due - right.due)[0];

  if (!nextDue) {
    return "No upcoming reviews scheduled.";
  }

  const dueDate = new Date(nextDue.due);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfTomorrow = startOfToday + 24 * 60 * 60 * 1000;

  if (nextDue.due < startOfTomorrow) {
    return "Next review: more cards due later today";
  }

  const tomorrowLabel = new Date(startOfTomorrow).toDateString();

  if (dueDate.toDateString() === tomorrowLabel) {
    return "Next review: more cards due tomorrow";
  }

  return `Next review: ${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
