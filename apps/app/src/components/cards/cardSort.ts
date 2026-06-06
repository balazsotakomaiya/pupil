import type { CardRecord } from "../../lib/cards";

export type CardSortMode = "created" | "due" | "front" | "state" | "updated";

export const CARD_SORT_OPTIONS: Array<{ label: string; value: CardSortMode }> = [
  { label: "Due soonest", value: "due" },
  { label: "Recently updated", value: "updated" },
  { label: "Newest created", value: "created" },
  { label: "Front A-Z", value: "front" },
  { label: "State", value: "state" },
];

export function sortCardsForList(cards: CardRecord[], sortMode: CardSortMode): CardRecord[] {
  return [...cards].sort((left, right) => compareCardsForList(left, right, sortMode));
}

function compareCardsForList(left: CardRecord, right: CardRecord, sortMode: CardSortMode): number {
  const suspendedRank = Number(left.suspended) - Number(right.suspended);

  if (suspendedRank !== 0) {
    return suspendedRank;
  }

  switch (sortMode) {
    case "created":
      return right.createdAt - left.createdAt || fallbackCompare(left, right);
    case "front":
      return compareText(left.front, right.front) || fallbackCompare(left, right);
    case "state":
      return left.state - right.state || left.due - right.due || fallbackCompare(left, right);
    case "updated":
      return (
        right.updatedAt - left.updatedAt || left.due - right.due || fallbackCompare(left, right)
      );
    case "due":
      return (
        left.due - right.due || right.updatedAt - left.updatedAt || fallbackCompare(left, right)
      );
  }
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function fallbackCompare(left: CardRecord, right: CardRecord): number {
  return compareText(left.front, right.front) || compareText(left.id, right.id);
}
