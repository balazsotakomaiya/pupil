import { createEmptyCard, type Card as FsrsCard, fsrs } from "ts-fsrs";
import type { CardRecord } from "./cards";

export type FsrsReviewGrade = 1 | 2 | 3 | 4;

export type CardFsrsFields = {
  difficulty: number;
  due: number;
  elapsedDays: number;
  lapses: number;
  lastReview: number | null;
  learningSteps: number;
  reps: number;
  scheduledDays: number;
  stability: number;
  state: number;
};

export type FsrsReviewLog = {
  due: number;
  elapsedDays: number | null;
  reviewTime: number;
  scheduledDays: number;
  state: number;
};

export type FsrsPreview = {
  grade: FsrsReviewGrade;
  intervalLabel: string;
  reviewLog: FsrsReviewLog;
  updatedCard: CardFsrsFields;
};

export type FsrsScheduleResult = Omit<FsrsPreview, "grade" | "intervalLabel">;

const scheduler = fsrs();
const GRADES: FsrsReviewGrade[] = [1, 2, 3, 4];

export function createNewCardFsrsFields(now = Date.now()): CardFsrsFields {
  return mapFsrsCard(createEmptyCard(new Date(now)));
}

export function previewCardScheduling(card: CardRecord, reviewedAt = Date.now()): FsrsPreview[] {
  return GRADES.map((grade) => {
    const next = scheduler.next(toFsrsCard(card), new Date(reviewedAt), grade);

    return {
      grade,
      intervalLabel: formatIntervalLabel(next.card.due.getTime() - reviewedAt),
      reviewLog: mapReviewLog(next.log),
      updatedCard: mapFsrsCard(next.card),
    };
  });
}

export function scheduleCard(
  card: CardRecord,
  grade: FsrsReviewGrade,
  reviewedAt = Date.now(),
): FsrsScheduleResult {
  const next = scheduler.next(toFsrsCard(card), new Date(reviewedAt), grade);

  return {
    reviewLog: mapReviewLog(next.log),
    updatedCard: mapFsrsCard(next.card),
  };
}

function toFsrsCard(card: CardRecord): FsrsCard {
  return {
    difficulty: card.difficulty,
    due: new Date(card.due),
    elapsed_days: card.elapsedDays,
    lapses: card.lapses,
    last_review: card.lastReview === null ? undefined : new Date(card.lastReview),
    learning_steps: card.learningSteps,
    reps: card.reps,
    scheduled_days: card.scheduledDays,
    stability: card.stability,
    state: card.state,
  };
}

function mapFsrsCard(card: FsrsCard): CardFsrsFields {
  return {
    difficulty: card.difficulty,
    due: card.due.getTime(),
    elapsedDays: card.elapsed_days,
    lapses: card.lapses,
    lastReview: card.last_review ? card.last_review.getTime() : null,
    learningSteps: card.learning_steps,
    reps: card.reps,
    scheduledDays: card.scheduled_days,
    stability: card.stability,
    state: card.state,
  };
}

function mapReviewLog(
  log: Parameters<typeof scheduler.next>[0] extends never
    ? never
    : {
        due: Date;
        elapsed_days: number;
        review: Date;
        scheduled_days: number;
        state: number;
      },
) {
  return {
    due: log.due.getTime(),
    elapsedDays: log.elapsed_days,
    reviewTime: log.review.getTime(),
    scheduledDays: log.scheduled_days,
    state: log.state,
  };
}

function formatIntervalLabel(deltaMs: number) {
  const totalMinutes = Math.max(1, Math.round(deltaMs / (60 * 1000)));

  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const totalHours = Math.round(totalMinutes / 60);

  if (totalHours < 24) {
    return `${totalHours}h`;
  }

  const totalDays = Math.round(totalHours / 24);

  if (totalDays < 30) {
    return `${totalDays}d`;
  }

  const totalMonths = Math.max(1, Math.round(totalDays / 30));
  return `${totalMonths}mo`;
}
