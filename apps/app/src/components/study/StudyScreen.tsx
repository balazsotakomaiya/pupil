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
  onBack: () => void;
  onReviewCard: (input: { card: CardRecord; grade: StudyGrade }) => Promise<CardRecord>;
  sessionKey: number;
  scope: StudyScope;
  scopeLabel: string;
  space?: SpaceSummary | null;
};

export function StudyScreen({
  cards,
  onBack,
  onReviewCard,
  sessionKey,
  scope,
  scopeLabel,
  space = null,
}: StudyScreenProps) {
  const [sessionCards, setSessionCards] = useState<StudyCardRecord[]>(() => cards);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [pressedGrade, setPressedGrade] = useState<StudyGrade | null>(null);
  const [sessionGrades, setSessionGrades] = useState<StudyGrade[]>([]);
  const [isSummaryVisible, setIsSummaryVisible] = useState(
    () => buildDueQueue(cards, Date.now()).length === 0,
  );
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const queue = useMemo(() => buildDueQueue(sessionCards, now), [sessionCards, now]);
  const currentCard = queue[0] ?? null;
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
  const summarySubtitle =
    reviewedCount === 0 && queue.length === 0
      ? `Nothing is due in ${scopeLabel} right now. Come back when the next review window opens.`
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
    setIsSummaryVisible(buildDueQueue(cards, Date.now()).length === 0);
    setStartedAt(Date.now());
    setIsSubmittingReview(false);
    setError(null);
    setNow(Date.now());
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

      if (event.code === "Space" && !isAnswerVisible && !isSubmittingReview) {
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
  }, [isAnswerVisible, isSubmittingReview, isSummaryVisible, onBack, pressedGrade]);

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

      if (buildDueQueue(nextCards, nextNow).length === 0) {
        setIsSummaryVisible(true);
      }
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "Failed to save review.");
    } finally {
      setPressedGrade(null);
      setIsSubmittingReview(false);
    }
  }

  function handleRestart() {
    setIsAnswerVisible(false);
    setPressedGrade(null);
    setSessionGrades([]);
    setIsSummaryVisible(buildDueQueue(sessionCards, Date.now()).length === 0);
    setStartedAt(Date.now());
    setIsSubmittingReview(false);
    setError(null);
    setNow(Date.now());
  }

  return (
    <div className="session-shell">
      <StudyBar current={currentCounter} onEnd={() => setIsSummaryVisible(true)} scopeLabel={scopeLabel} total={totalCards} />

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
      ) : currentCard ? (
        <div className="session-area">
          <div className="session-card-wrap">
            <StudyReviewCard card={currentCard} isAnswerVisible={isAnswerVisible} />
          </div>

          <StudyActions
            error={error}
            intervalPreviews={intervalPreviews}
            isAnswerVisible={isAnswerVisible}
            isSubmitting={isSubmittingReview}
            onRate={(grade) => void handleRate(grade)}
            onReveal={() => setIsAnswerVisible(true)}
            pressedGrade={pressedGrade}
          />
        </div>
      ) : null}
    </div>
  );
}

function buildDueQueue(cards: StudyCardRecord[], now: number) {
  return [...cards]
    .filter((card) => card.due <= now)
    .sort((left, right) => left.due - right.due || right.updatedAt - left.updatedAt);
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
