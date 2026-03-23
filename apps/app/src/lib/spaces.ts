import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./runtime";

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

const WEB_STORAGE_KEY = "pupil.web.spaces";

export async function listSpaces(): Promise<SpaceSummary[]> {
  if (isTauriRuntime()) {
    return invoke<SpaceSummary[]>("list_spaces");
  }

  return readWebSpaces();
}

export async function createSpace(input: { name: string }): Promise<SpaceSummary> {
  if (isTauriRuntime()) {
    return invoke<SpaceSummary>("create_space", { name: input.name });
  }

  const name = normalizeSpaceName(input.name);
  const spaces = readWebSpaces();
  ensureUniqueSpaceName(spaces, name);

  const now = Date.now();
  const createdSpace: SpaceSummary = {
    id: createWebId(),
    name,
    cardCount: 0,
    dueTodayCount: 0,
    streak: 0,
    createdAt: now,
    updatedAt: now,
  };

  writeWebSpaces([createdSpace, ...spaces]);

  return createdSpace;
}

export async function renameSpace(input: { id: string; name: string }): Promise<SpaceSummary> {
  if (isTauriRuntime()) {
    return invoke<SpaceSummary>("rename_space", {
      id: input.id,
      name: input.name,
    });
  }

  const name = normalizeSpaceName(input.name);
  const spaces = readWebSpaces();
  const nextIndex = spaces.findIndex((space) => space.id === input.id);

  if (nextIndex === -1) {
    throw new Error("Space not found.");
  }

  ensureUniqueSpaceName(spaces, name, input.id);

  const nextSpace: SpaceSummary = {
    ...spaces[nextIndex],
    name,
    updatedAt: Date.now(),
  };

  spaces[nextIndex] = nextSpace;
  writeWebSpaces(spaces);

  return nextSpace;
}

export async function deleteSpace(input: { id: string }): Promise<void> {
  if (isTauriRuntime()) {
    await invoke("delete_space", { id: input.id });
    return;
  }

  const spaces = readWebSpaces();
  const nextSpaces = spaces.filter((space) => space.id !== input.id);

  if (nextSpaces.length === spaces.length) {
    throw new Error("Space not found.");
  }

  writeWebSpaces(nextSpaces);
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

function ensureUniqueSpaceName(spaces: SpaceSummary[], name: string, ignoreId?: string): void {
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
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  const raw = window.localStorage.getItem(WEB_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isSpaceSummary)
      .sort((left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt);
  } catch {
    return [];
  }
}

function writeWebSpaces(spaces: SpaceSummary[]): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  const nextSpaces = [...spaces].sort(
    (left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt,
  );

  window.localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(nextSpaces));
}

function createWebId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `space-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isSpaceSummary(value: unknown): value is SpaceSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const space = value as Partial<SpaceSummary>;

  return (
    typeof space.id === "string" &&
    typeof space.name === "string" &&
    typeof space.cardCount === "number" &&
    typeof space.dueTodayCount === "number" &&
    typeof space.streak === "number" &&
    typeof space.createdAt === "number" &&
    typeof space.updatedAt === "number"
  );
}
