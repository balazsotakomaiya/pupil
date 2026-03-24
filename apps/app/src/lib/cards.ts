import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./runtime";

export type CardSource = "manual" | "ai" | "anki";

export type CardRecord = {
  id: string;
  spaceId: string;
  spaceName: string;
  front: string;
  back: string;
  tags: string[];
  source: CardSource;
  state: number;
  due: number;
  createdAt: number;
  updatedAt: number;
};

type StoredWebSpace = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

const WEB_SPACE_STORAGE_KEY = "pupil.web.spaces";
const WEB_CARD_STORAGE_KEY = "pupil.web.cards";

export async function listCards(input: { spaceId?: string } = {}): Promise<CardRecord[]> {
  if (isTauriRuntime()) {
    return invoke<CardRecord[]>("list_cards", { spaceId: input.spaceId ?? null });
  }

  const cards = readWebCards();

  return cards.filter((card) => (input.spaceId ? card.spaceId === input.spaceId : true));
}

export async function createCard(input: {
  spaceId: string;
  front: string;
  back: string;
  tags: string[];
}): Promise<CardRecord> {
  if (isTauriRuntime()) {
    return invoke<CardRecord>("create_card", { input });
  }

  const spaces = readStoredWebSpaces();
  const matchingSpace = spaces.find((space) => space.id === input.spaceId);

  if (!matchingSpace) {
    throw new Error("Space not found.");
  }

  const normalized = normalizeCardInput(input);
  const now = Date.now();
  const createdCard: CardRecord = {
    id: createWebId("card"),
    spaceId: matchingSpace.id,
    spaceName: matchingSpace.name,
    front: normalized.front,
    back: normalized.back,
    tags: normalized.tags,
    source: "manual",
    state: 0,
    due: now,
    createdAt: now,
    updatedAt: now,
  };

  writeWebCards([createdCard, ...readWebCards()]);
  touchWebSpace(matchingSpace.id, spaces, now);

  return createdCard;
}

export async function updateCard(input: {
  id: string;
  spaceId: string;
  front: string;
  back: string;
  tags: string[];
}): Promise<CardRecord> {
  if (isTauriRuntime()) {
    return invoke<CardRecord>("update_card", { input });
  }

  const normalized = normalizeCardInput(input);
  const cards = readWebCards();
  const cardIndex = cards.findIndex((card) => card.id === input.id);

  if (cardIndex === -1) {
    throw new Error("Card or space not found.");
  }

  const spaces = readStoredWebSpaces();
  const matchingSpace = spaces.find((space) => space.id === input.spaceId);

  if (!matchingSpace) {
    throw new Error("Space not found.");
  }

  const now = Date.now();
  const currentCard = cards[cardIndex];
  const nextCard: CardRecord = {
    ...currentCard,
    spaceId: matchingSpace.id,
    spaceName: matchingSpace.name,
    front: normalized.front,
    back: normalized.back,
    tags: normalized.tags,
    updatedAt: now,
  };

  cards[cardIndex] = nextCard;
  writeWebCards(cards);
  touchWebSpace(currentCard.spaceId, spaces, now);
  if (currentCard.spaceId !== matchingSpace.id) {
    touchWebSpace(matchingSpace.id, spaces, now);
  }

  return nextCard;
}

export async function deleteCard(input: { id: string }): Promise<void> {
  if (isTauriRuntime()) {
    await invoke("delete_card", { id: input.id });
    return;
  }

  const cards = readWebCards();
  const existingCard = cards.find((card) => card.id === input.id);

  if (!existingCard) {
    throw new Error("Card not found.");
  }

  writeWebCards(cards.filter((card) => card.id !== input.id));
  touchWebSpace(existingCard.spaceId, readStoredWebSpaces(), Date.now());
}

function normalizeCardInput(input: {
  spaceId: string;
  front: string;
  back: string;
  tags: string[];
}): {
  front: string;
  back: string;
  tags: string[];
} {
  const front = input.front.trim();
  const back = input.back.trim();

  if (!input.spaceId.trim()) {
    throw new Error("Space identifier is required.");
  }

  if (!front) {
    throw new Error("Front can't be empty.");
  }

  if (!back) {
    throw new Error("Back can't be empty.");
  }

  return {
    front,
    back,
    tags: normalizeTags(input.tags),
  };
}

function normalizeTags(tags: string[]): string[] {
  const normalized: string[] = [];

  for (const tag of tags) {
    const trimmed = tag.trim();

    if (!trimmed || normalized.includes(trimmed)) {
      continue;
    }

    normalized.push(trimmed);
  }

  return normalized;
}

function readWebCards(): CardRecord[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  const raw = window.localStorage.getItem(WEB_CARD_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isCardRecord).sort(sortCards);
  } catch {
    return [];
  }
}

function writeWebCards(cards: CardRecord[]): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(WEB_CARD_STORAGE_KEY, JSON.stringify([...cards].sort(sortCards)));
}

function touchWebSpace(spaceId: string, spaces: StoredWebSpace[], timestamp: number): void {
  const nextSpaces = spaces.map((space) =>
    space.id === spaceId ? { ...space, updatedAt: timestamp } : space,
  );

  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(
    WEB_SPACE_STORAGE_KEY,
    JSON.stringify(nextSpaces.sort((left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt)),
  );
}

function readStoredWebSpaces(): StoredWebSpace[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  const raw = window.localStorage.getItem(WEB_SPACE_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isStoredWebSpace);
  } catch {
    return [];
  }
}

function createWebId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sortCards(left: CardRecord, right: CardRecord): number {
  return right.updatedAt - left.updatedAt || right.createdAt - left.createdAt;
}

function isCardRecord(value: unknown): value is CardRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const card = value as Partial<CardRecord>;

  return (
    typeof card.id === "string" &&
    typeof card.spaceId === "string" &&
    typeof card.spaceName === "string" &&
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

function isStoredWebSpace(value: unknown): value is StoredWebSpace {
  if (!value || typeof value !== "object") {
    return false;
  }

  const space = value as Partial<StoredWebSpace>;

  return (
    typeof space.id === "string" &&
    typeof space.name === "string" &&
    typeof space.createdAt === "number" &&
    typeof space.updatedAt === "number"
  );
}
