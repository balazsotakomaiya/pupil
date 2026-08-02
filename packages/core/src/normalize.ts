import type { CardSource } from "./types";

export const SPACE_NAME_MAX_LENGTH = 80;

export type NormalizedCardInput = {
  back: string;
  front: string;
  source: CardSource;
  tags: string[];
};

export type CardInput = {
  back: string;
  front: string;
  source?: CardSource;
  spaceId: string;
  tags: string[];
};

/**
 * Validation shared by every storage backend. Backends may re-validate closer
 * to the store (the desktop app also normalizes in Rust), but callers should be
 * able to rely on the same rules regardless of where the data ends up.
 */
export function normalizeSpaceName(name: string): string {
  const trimmed = name.trim();

  if (!trimmed) {
    throw new Error("Space name can't be empty.");
  }

  if (Array.from(trimmed).length > SPACE_NAME_MAX_LENGTH) {
    throw new Error(`Space names must be ${SPACE_NAME_MAX_LENGTH} characters or fewer.`);
  }

  return trimmed;
}

export function normalizeCardInput(input: CardInput): NormalizedCardInput {
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
    back,
    front,
    source: normalizeCardSource(input.source),
    tags: normalizeTags(input.tags),
  };
}

export function normalizeCardSource(source?: string): CardSource {
  if (source === "ai" || source === "anki" || source === "manual") {
    return source;
  }

  return "manual";
}

export function normalizeTags(tags: string[]): string[] {
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

/**
 * Case-insensitive comparison key for space names. Deliberately ASCII-only so
 * it matches the `lower(name)` unique index used by the SQLite backend.
 */
export function spaceNameKey(name: string): string {
  return name.replace(/[A-Z]/g, (character) => character.toLowerCase());
}
