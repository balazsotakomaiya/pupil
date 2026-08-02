import type { StudyQueueSnapshotData } from "./study-queue";
import type {
  CardRecord,
  CardSource,
  DashboardStats,
  FsrsReviewGrade,
  RecentActivityRecord,
  SpaceStats,
  SpaceSummary,
  StudySettings,
} from "./types";

export type ListCardsInput = {
  spaceId?: string;
};

export type CreateCardInput = {
  back: string;
  front: string;
  source?: CardSource;
  spaceId: string;
  tags: string[];
};

export type UpdateCardInput = {
  back: string;
  front: string;
  id: string;
  spaceId: string;
  tags: string[];
};

export type DeleteCardInput = {
  id: string;
};

export type SuspendCardInput = {
  id: string;
  suspended: boolean;
};

export type ReviewCardInput = {
  card: CardRecord;
  grade: FsrsReviewGrade;
  reviewedAt?: number;
};

export type UndoReviewCardInput = {
  snapshot: CardRecord;
};

export type CreateSpaceInput = {
  name: string;
};

export type RenameSpaceInput = {
  id: string;
  name: string;
};

export type DeleteSpaceInput = {
  id: string;
};

/**
 * The persistence seam every Pupil surface implements.
 *
 * Today the desktop app fulfils this with Tauri commands backed by SQLite and
 * the browser fallback fulfils it with local web storage. A browser PWA
 * (IndexedDB), a mobile shell (native SQLite), and a cloud-sync adapter are all
 * additional implementations of this same interface rather than new branches
 * inside the calling code.
 *
 * Implementations own persistence. `reviewCard` takes the card and the grade
 * and resolves the next FSRS state with the shared scheduler before storing it,
 * so scheduling has exactly one definition no matter which backend is active.
 */
export interface PupilStorage {
  listSpaces(): Promise<SpaceSummary[]>;
  createSpace(input: CreateSpaceInput): Promise<SpaceSummary>;
  renameSpace(input: RenameSpaceInput): Promise<SpaceSummary>;
  deleteSpace(input: DeleteSpaceInput): Promise<void>;

  listCards(input?: ListCardsInput): Promise<CardRecord[]>;
  createCard(input: CreateCardInput): Promise<CardRecord>;
  updateCard(input: UpdateCardInput): Promise<CardRecord>;
  deleteCard(input: DeleteCardInput): Promise<void>;
  suspendCard(input: SuspendCardInput): Promise<CardRecord>;
  reviewCard(input: ReviewCardInput): Promise<CardRecord>;
  undoReviewCard(input: UndoReviewCardInput): Promise<CardRecord>;

  getDashboardStats(): Promise<DashboardStats>;
  listSpaceStats(): Promise<SpaceStats[]>;
  listRecentActivity(): Promise<RecentActivityRecord[]>;

  getStudySettings(): Promise<StudySettings>;
  saveStudySettings(newCardsLimit: number | null): Promise<StudySettings>;
  getStudyQueueSnapshot(): Promise<StudyQueueSnapshotData>;
}
