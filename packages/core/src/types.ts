export type CardSource = "manual" | "ai" | "anki";

export type FsrsReviewGrade = 1 | 2 | 3 | 4;

/**
 * The FSRS scheduling state carried by every card. Scheduling is computed in
 * TypeScript and merely persisted by each storage backend, so this shape is the
 * contract between the scheduler and whatever store is behind it.
 */
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

export type CardRecord = CardFsrsFields & {
  id: string;
  spaceId: string;
  spaceName: string;
  front: string;
  back: string;
  tags: string[];
  source: CardSource;
  createdAt: number;
  updatedAt: number;
  suspended: boolean;
};

export type SpaceSummary = {
  id: string;
  name: string;
  cardCount: number;
  dueTodayCount: number;
  streak: number;
  createdAt: number;
  updatedAt: number;
};

export type ReviewLogRecord = {
  id: string;
  cardId: string;
  due: number;
  elapsedDays: number | null;
  grade: FsrsReviewGrade;
  reviewTime: number;
  scheduledDays: number;
  spaceId: string;
  state: number;
};

export type StudyDayRecord = {
  day: string;
  spaceId: string | null;
};

export type DashboardStats = {
  dueToday: number;
  globalStreak: number;
  studiedToday: number;
  studyDays: string[];
  totalCards: number;
};

export type SpaceStats = {
  retention30d: number | null;
  reviewActivity7d: number[];
  spaceId: string;
};

export type RecentActivityRecord = {
  id: string;
  reviewCount: number;
  reviewTime: number;
  spaceId: string;
  spaceName: string;
};

export type StudySettings = {
  newCardsLimit: number | null;
  newCardsToday: number;
};
