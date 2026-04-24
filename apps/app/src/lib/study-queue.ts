import { type CardRecord, listCards } from "./cards";
import { invokeCommand } from "./ipc";
import { isTauriRuntime } from "./runtime";
import { computeNewCardsBudget, getStudySettings } from "./study-settings";

type QueueCard = Pick<
  CardRecord,
  "createdAt" | "due" | "id" | "spaceId" | "state" | "suspended" | "updatedAt"
>;

export type StudyQueueSnapshot = {
  actionableDueBySpace: Map<string, number>;
  actionableDueCount: number;
  admittedCardIds: Set<string>;
  gatedNewCount: number;
  overdueReviewCount: number;
};

export type StudyQueueSpaceCount = {
  dueCount: number;
  spaceId: string;
};

export type StudyQueueSnapshotData = {
  actionableDueBySpace: StudyQueueSpaceCount[];
  actionableDueCount: number;
  gatedNewCount: number;
  overdueReviewCount: number;
};

export function buildDueQueue<T extends QueueCard>(cards: T[], now: number): T[] {
  return [...cards]
    .filter((card) => card.due <= now && !card.suspended)
    .sort(
      (left, right) =>
        left.due - right.due ||
        right.updatedAt - left.updatedAt ||
        right.createdAt - left.createdAt ||
        left.id.localeCompare(right.id),
    );
}

export function buildAdmittedSet<T extends QueueCard>(
  cards: T[],
  now: number,
  newCardsBudget: number | null,
): Set<string> {
  const dueCards = buildDueQueue(cards, now);
  const reviewCards = dueCards.filter((card) => card.state > 0);
  const newCards = dueCards.filter((card) => card.state === 0);
  const admittedNewCards = newCardsBudget !== null ? newCards.slice(0, newCardsBudget) : newCards;

  return new Set([...reviewCards, ...admittedNewCards].map((card) => card.id));
}

export function buildStudyQueueSnapshot<T extends QueueCard>(
  cards: T[],
  now: number,
  newCardsBudget: number | null,
): StudyQueueSnapshot {
  const slackThreshold = now - 3 * 24 * 60 * 60 * 1000;
  const dueCards = buildDueQueue(cards, now);
  const reviewCards = dueCards.filter((card) => card.state > 0);
  const newCards = dueCards.filter((card) => card.state === 0);
  const admittedNewCards = newCardsBudget !== null ? newCards.slice(0, newCardsBudget) : newCards;
  const admittedCards = [...reviewCards, ...admittedNewCards];
  const actionableDueBySpace = new Map<string, number>();

  for (const card of admittedCards) {
    actionableDueBySpace.set(card.spaceId, (actionableDueBySpace.get(card.spaceId) ?? 0) + 1);
  }

  return {
    actionableDueBySpace,
    actionableDueCount: admittedCards.length,
    admittedCardIds: new Set(admittedCards.map((card) => card.id)),
    gatedNewCount: newCards.length - admittedNewCards.length,
    overdueReviewCount: reviewCards.filter((card) => card.due < slackThreshold).length,
  };
}

export function buildStudyQueueCountMap(
  actionableDueBySpace: StudyQueueSpaceCount[],
): Map<string, number> {
  return new Map(actionableDueBySpace.map((entry) => [entry.spaceId, entry.dueCount]));
}

export async function getStudyQueueSnapshot(): Promise<StudyQueueSnapshotData> {
  if (isTauriRuntime()) {
    return invokeCommand<StudyQueueSnapshotData>("get_study_queue_snapshot");
  }

  const [cards, studySettings] = await Promise.all([listCards(), getStudySettings()]);
  const snapshot = buildStudyQueueSnapshot(
    cards,
    Date.now(),
    computeNewCardsBudget(studySettings.newCardsLimit, studySettings.newCardsToday),
  );

  return {
    actionableDueBySpace: Array.from(snapshot.actionableDueBySpace, ([spaceId, dueCount]) => ({
      dueCount,
      spaceId,
    })),
    actionableDueCount: snapshot.actionableDueCount,
    gatedNewCount: snapshot.gatedNewCount,
    overdueReviewCount: snapshot.overdueReviewCount,
  };
}
