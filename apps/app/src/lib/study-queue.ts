import type { CardRecord } from "./cards";

type QueueCard = Pick<CardRecord, "due" | "id" | "spaceId" | "state" | "suspended" | "updatedAt">;

export type StudyQueueSnapshot = {
  actionableDueBySpace: Map<string, number>;
  actionableDueCount: number;
  admittedCardIds: Set<string>;
  gatedNewCount: number;
};

export function buildDueQueue<T extends QueueCard>(cards: T[], now: number): T[] {
  return [...cards]
    .filter((card) => card.due <= now && !card.suspended)
    .sort((left, right) => left.due - right.due || right.updatedAt - left.updatedAt);
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
  };
}
