import type {
  CardRecord,
  CreateCardInput,
  DeleteCardInput,
  ListCardsInput,
  ReviewCardInput,
  SuspendCardInput,
  UndoReviewCardInput,
  UpdateCardInput,
} from "@pupil/core";
import { getStorage } from "./storage";

export type { CardRecord, CardSource } from "@pupil/core";

export function listCards(input: ListCardsInput = {}): Promise<CardRecord[]> {
  return getStorage().listCards(input);
}

export function createCard(input: CreateCardInput): Promise<CardRecord> {
  return getStorage().createCard(input);
}

export function updateCard(input: UpdateCardInput): Promise<CardRecord> {
  return getStorage().updateCard(input);
}

export function deleteCard(input: DeleteCardInput): Promise<void> {
  return getStorage().deleteCard(input);
}

export function suspendCard(input: SuspendCardInput): Promise<CardRecord> {
  return getStorage().suspendCard(input);
}

export function reviewCard(input: ReviewCardInput): Promise<CardRecord> {
  return getStorage().reviewCard(input);
}

export function undoReviewCard(input: UndoReviewCardInput): Promise<CardRecord> {
  return getStorage().undoReviewCard(input);
}
