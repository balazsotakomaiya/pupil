import { invokeCommand } from "./ipc";
import { isTauriRuntime } from "./runtime";
import {
  createWebId,
  readStoredWebSpaces,
  readWebArray,
  readWebCollection,
  type StoredWebSpace,
  WEB_STORAGE_KEYS,
  writeStoredWebSpaces,
  writeWebCollection,
} from "./web-store";

export const SPACE_NAME_MAX_LENGTH = 80;

export type SpaceSummary = {
  id: string;
  name: string;
  cardCount: number;
  dueTodayCount: number;
  streak: number;
  createdAt: number;
  updatedAt: number;
};

type StoredWebCard = {
  id: string;
  spaceId: string;
  spaceName?: string;
  front: string;
  back: string;
  tags: string[];
  source: "manual" | "ai" | "anki";
  state: number;
  due: number;
  createdAt: number;
  updatedAt: number;
};

type StoredWebReviewLog = {
  reviewTime: number;
  spaceId: string;
  spaceName?: string;
};

export async function listSpaces(): Promise<SpaceSummary[]> {
  if (isTauriRuntime()) {
    return invokeCommand<SpaceSummary[]>("list_spaces");
  }

  return readWebSpaces();
}

export async function createSpace(input: { name: string }): Promise<SpaceSummary> {
  if (isTauriRuntime()) {
    return invokeCommand<SpaceSummary>("create_space", { name: input.name });
  }

  const name = normalizeSpaceName(input.name);
  const spaces = readStoredWebSpaces();
  ensureUniqueSpaceName(spaces, name);

  const now = Date.now();
  const createdSpace: StoredWebSpace = {
    id: createWebId("space"),
    name,
    createdAt: now,
    updatedAt: now,
  };

  writeStoredWebSpaces([createdSpace, ...spaces]);

  return toSpaceSummary(createdSpace, readStoredWebCards(), now);
}

export async function renameSpace(input: { id: string; name: string }): Promise<SpaceSummary> {
  if (isTauriRuntime()) {
    return invokeCommand<SpaceSummary>("rename_space", {
      id: input.id,
      name: input.name,
    });
  }

  const name = normalizeSpaceName(input.name);
  const spaces = readStoredWebSpaces();
  const nextIndex = spaces.findIndex((space) => space.id === input.id);

  if (nextIndex === -1) {
    throw new Error("Space not found.");
  }

  ensureUniqueSpaceName(spaces, name, input.id);

  const nextSpace: StoredWebSpace = {
    ...spaces[nextIndex],
    name,
    updatedAt: Date.now(),
  };

  spaces[nextIndex] = nextSpace;
  writeStoredWebSpaces(spaces);
  renameStoredCardSpaces(input.id, name);
  renameStoredReviewLogSpaces(input.id, name);

  return toSpaceSummary(nextSpace, readStoredWebCards(), Date.now());
}

export async function deleteSpace(input: { id: string }): Promise<void> {
  if (isTauriRuntime()) {
    await invokeCommand("delete_space", { id: input.id });
    return;
  }

  const spaces = readStoredWebSpaces();
  const nextSpaces = spaces.filter((space) => space.id !== input.id);

  if (nextSpaces.length === spaces.length) {
    throw new Error("Space not found.");
  }

  writeStoredWebSpaces(nextSpaces);
  writeStoredWebCards(readStoredWebCards().filter((card) => card.spaceId !== input.id));
}

function normalizeSpaceName(name: string): string {
  const trimmed = name.trim();

  if (!trimmed) {
    throw new Error("Space name can't be empty.");
  }

  if (Array.from(trimmed).length > SPACE_NAME_MAX_LENGTH) {
    throw new Error(`Space names must be ${SPACE_NAME_MAX_LENGTH} characters or fewer.`);
  }

  return trimmed;
}

function ensureUniqueSpaceName(spaces: StoredWebSpace[], name: string, ignoreId?: string): void {
  const normalizedName = normalizeAsciiLower(name);
  const conflict = spaces.some(
    (space) => space.id !== ignoreId && normalizeAsciiLower(space.name) === normalizedName,
  );

  if (conflict) {
    throw new Error("A space with that name already exists.");
  }
}

function normalizeAsciiLower(value: string): string {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

function readWebSpaces(): SpaceSummary[] {
  const spaces = readStoredWebSpaces();
  const cards = readStoredWebCards();
  const now = Date.now();

  return spaces
    .map((space) => toSpaceSummary(space, cards, now))
    .sort((left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt);
}

function toSpaceSummary(space: StoredWebSpace, cards: StoredWebCard[], now: number): SpaceSummary {
  const matchingCards = cards.filter((card) => card.spaceId === space.id);

  return {
    id: space.id,
    name: space.name,
    cardCount: matchingCards.length,
    dueTodayCount: matchingCards.filter((card) => card.due <= now).length,
    streak: 0,
    createdAt: space.createdAt,
    updatedAt: space.updatedAt,
  };
}

function readStoredWebCards(): StoredWebCard[] {
  return readWebCollection(WEB_STORAGE_KEYS.cards, isStoredWebCard);
}

function writeStoredWebCards(cards: StoredWebCard[]): void {
  writeWebCollection(WEB_STORAGE_KEYS.cards, cards);
}

function renameStoredCardSpaces(spaceId: string, spaceName: string): void {
  const cards = readStoredWebCards();
  const nextCards = cards.map((card) => (card.spaceId === spaceId ? { ...card, spaceName } : card));

  writeStoredWebCards(nextCards);
}

function renameStoredReviewLogSpaces(spaceId: string, spaceName: string): void {
  const logs = readWebArray(WEB_STORAGE_KEYS.reviewLogs);

  if (logs.length === 0) {
    return;
  }

  const nextLogs = logs.map((value) => {
    if (!isStoredWebReviewLog(value) || value.spaceId !== spaceId) {
      return value;
    }

    return { ...value, spaceName };
  });

  writeWebCollection(WEB_STORAGE_KEYS.reviewLogs, nextLogs);
}

function isStoredWebReviewLog(value: unknown): value is StoredWebReviewLog {
  if (!value || typeof value !== "object") {
    return false;
  }

  const log = value as Partial<StoredWebReviewLog>;

  return typeof log.spaceId === "string" && typeof log.reviewTime === "number";
}

function isStoredWebCard(value: unknown): value is StoredWebCard {
  if (!value || typeof value !== "object") {
    return false;
  }

  const card = value as Partial<StoredWebCard>;

  return (
    typeof card.id === "string" &&
    typeof card.spaceId === "string" &&
    typeof card.front === "string" &&
    typeof card.back === "string" &&
    Array.isArray(card.tags) &&
    typeof card.source === "string" &&
    typeof card.state === "number" &&
    typeof card.due === "number" &&
    typeof card.createdAt === "number" &&
    typeof card.updatedAt === "number"
  );
}
