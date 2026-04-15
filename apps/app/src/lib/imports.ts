import { invoke } from "@tauri-apps/api/core";
import { decompress as decompressZstd } from "fzstd";
import JSZip from "jszip";
import initSqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { SPACE_NAME_MAX_LENGTH } from "./spaces";
import { isTauriRuntime } from "./runtime";

type ParsedAnkiCard = {
  back: string;
  deckName: string;
  front: string;
  tags: string[];
};

type ParsedAnkiPackage = {
  cards: ParsedAnkiCard[];
  deckCount: number;
  noteCount: number;
  sourceFileName: string;
};

type ImportAnkiPayload = {
  cards: ParsedAnkiCard[];
  sourceFileName: string;
  targetSpaceId?: string | null;
};

type ImportDeckResult = {
  deckName: string;
  importedCount: number;
  skippedCount: number;
  spaceId: string;
  spaceName: string;
  totalCount: number;
};

export type ImportExecutionResult = {
  createdSpaceCount: number;
  deckCount: number;
  decks: ImportDeckResult[];
  duplicateCount: number;
  fileSize: number;
  importedAt: number;
  importedCount: number;
  parsedCardCount: number;
  sourceFileName: string;
  status: "complete" | "partial";
  statusLabel: string;
  targetSpaceId?: string | null;
  targetSpaceName?: string | null;
};

type StoredWebSpace = {
  createdAt: number;
  id: string;
  name: string;
  updatedAt: number;
};

type StoredWebCard = {
  back: string;
  createdAt: number;
  due: number;
  front: string;
  id: string;
  source: "manual" | "ai" | "anki";
  spaceId: string;
  state: number;
  tags: string[];
  updatedAt: number;
};

const IMPORT_HISTORY_STORAGE_KEY = "pupil.web.import-history";
const WEB_SPACE_STORAGE_KEY = "pupil.web.spaces";
const WEB_CARD_STORAGE_KEY = "pupil.web.cards";
const COLLECTION_FILE_NAMES = ["collection.anki21b", "collection.anki21", "collection.anki2"] as const;
const CLOZE_PATTERN = /\{\{c(\d+)::([\s\S]*?)(?:::(.*?))?\}\}/gi;

let sqlJsPromise: Promise<Awaited<ReturnType<typeof initSqlJs>>> | null = null;

export async function importApkgFile(
  file: File,
  options: {
    onStageChange?: (model: {
      details: Array<{ accent?: "success"; label: string; value: string }>;
      fileName: string;
      fileSubtext: string;
      progress: number;
      statusLabel: string;
      statusVariant: "parsing" | "complete" | "error" | "queued";
    }) => void;
    targetSpaceId?: string | null;
  } = {},
): Promise<ImportExecutionResult> {
  const { onStageChange, targetSpaceId = null } = options;
  console.info("[import] Starting Anki import", {
    fileName: file.name,
    fileSize: file.size,
    targetSpaceId,
  });

  try {
    onStageChange?.({
      details: [
        { label: "file selected", value: formatFileSize(file.size) },
        { label: "archive", value: ".apkg" },
        { accent: "success", label: "target scheduler", value: "FSRS-5" },
      ],
      fileName: file.name,
      fileSubtext: `${formatFileSize(file.size)} · loading package`,
      progress: 12,
      statusLabel: "Parsing…",
      statusVariant: "parsing",
    });

    const parsed = await parseApkgFile(file);

    console.info("[import] Parsed Anki package", {
      cardCount: parsed.cards.length,
      deckCount: parsed.deckCount,
      fileName: file.name,
      noteCount: parsed.noteCount,
      targetSpaceId,
    });

    if (parsed.cards.length === 0) {
      throw new Error(
        "No importable cards were found in this package. The deck may be empty or use an unsupported note layout.",
      );
    }

    onStageChange?.({
      details: [
        { label: "cards parsed", value: formatNumber(parsed.cards.length) },
        { label: "notes detected", value: formatNumber(parsed.noteCount) },
        { label: "decks found", value: formatNumber(parsed.deckCount) },
      ],
      fileName: file.name,
      fileSubtext: `${formatFileSize(file.size)} · importing cards`,
      progress: 64,
      statusLabel: "Importing…",
      statusVariant: "parsing",
    });

    const persisted = await persistAnkiImport({
      cards: parsed.cards,
      sourceFileName: parsed.sourceFileName,
      targetSpaceId,
    });

    const result: ImportExecutionResult = {
      ...persisted,
      fileSize: file.size,
      importedAt: Date.now(),
      parsedCardCount: parsed.cards.length,
      sourceFileName: parsed.sourceFileName,
      status: "complete",
      statusLabel: "complete",
    };

    writeImportHistory([result, ...readImportHistory()]);

    onStageChange?.({
      details: [
        { accent: "success", label: "cards imported", value: formatNumber(result.importedCount) },
        { label: "duplicates skipped", value: formatNumber(result.duplicateCount) },
        {
          label: targetSpaceId ? "source decks" : "spaces touched",
          value: formatNumber(result.deckCount),
        },
      ],
      fileName: file.name,
      fileSubtext: `${formatFileSize(file.size)} · import complete`,
      progress: 100,
      statusLabel: "Complete",
      statusVariant: "complete",
    });

    console.info("[import] Finished Anki import", {
      deckCount: result.deckCount,
      duplicateCount: result.duplicateCount,
      fileName: file.name,
      importedCount: result.importedCount,
      targetSpaceId: result.targetSpaceId,
      targetSpaceName: result.targetSpaceName,
    });

    return result;
  } catch (error: unknown) {
    console.error("[import] Failed Anki import", {
      error,
      fileName: file.name,
      fileSize: file.size,
      targetSpaceId,
    });
    throw error;
  }
}

export function readImportHistory(): ImportExecutionResult[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  const raw = window.localStorage.getItem(IMPORT_HISTORY_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isImportExecutionResult).sort((left, right) => right.importedAt - left.importedAt);
  } catch {
    return [];
  }
}

async function parseApkgFile(file: File): Promise<ParsedAnkiPackage> {
  if (!file.name.toLowerCase().endsWith(".apkg")) {
    throw new Error("Only .apkg files are supported.");
  }

  const archive = await JSZip.loadAsync(await file.arrayBuffer());
  const collectionEntry = COLLECTION_FILE_NAMES.map((fileName) => archive.file(fileName)).find(Boolean);

  if (!collectionEntry) {
    throw new Error("The .apkg file is missing collection.anki21b, collection.anki21, or collection.anki2.");
  }

  const SQL = await getSqlJs();
  const database = new SQL.Database(await readCollectionDatabase(collectionEntry));

  try {
    const decks = parseDeckMap(readCollectionJson(database, "decks"));
    const models = parseModelMap(readCollectionJson(database, "models"));
    const noteCount = readCount(database, "SELECT COUNT(*) FROM notes");
    const rows = readRows(database);
    const cards = rows
      .map((row) => mapAnkiRowToCard(row, decks, models))
      .filter((card): card is ParsedAnkiCard => card !== null);

    return {
      cards,
      deckCount: new Set(cards.map((card) => card.deckName)).size,
      noteCount,
      sourceFileName: file.name,
    };
  } finally {
    database.close();
  }
}

async function readCollectionDatabase(collectionEntry: JSZip.JSZipObject) {
  const bytes = await collectionEntry.async("uint8array");

  if (collectionEntry.name.endsWith(".anki21b")) {
    try {
      return decompressZstd(bytes);
    } catch (error: unknown) {
      throw new Error(
        error instanceof Error
          ? `Failed to decompress ${collectionEntry.name}: ${error.message}`
          : `Failed to decompress ${collectionEntry.name}.`,
      );
    }
  }

  return bytes;
}

async function persistAnkiImport(input: ImportAnkiPayload): Promise<Omit<ImportExecutionResult, "fileSize" | "importedAt" | "parsedCardCount" | "sourceFileName" | "status" | "statusLabel">> {
  if (isTauriRuntime()) {
    return invoke("import_anki_cards", { input });
  }

  return importAnkiCardsInWebStorage(input);
}

async function getSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: () => sqlWasmUrl,
    });
  }

  return sqlJsPromise;
}

function readCollectionJson(
  database: { exec: (sql: string) => Array<{ values?: unknown[][] }> },
  column: "decks" | "models",
) {
  const result = database.exec(`SELECT ${column} FROM col LIMIT 1`);
  const value = result[0]?.values?.[0]?.[0];

  if (typeof value !== "string") {
    return {};
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readCount(
  database: { exec: (sql: string) => Array<{ values?: unknown[][] }> },
  sql: string,
) {
  const result = database.exec(sql);
  return Number(result[0]?.values?.[0]?.[0] ?? 0);
}

function readRows(database: {
  exec: (sql: string) => Array<{ values?: unknown[][] }>;
}) {
  const result = database.exec(`
    SELECT notes.mid, notes.tags, notes.flds, cards.did, cards.ord
    FROM notes
    INNER JOIN cards ON cards.nid = notes.id
    ORDER BY cards.id ASC
  `);

  return (result[0]?.values ?? []).map((row) => ({
    deckId: String(row[3] ?? ""),
    fields: String(row[2] ?? ""),
    modelId: String(row[0] ?? ""),
    order: Number(row[4] ?? 0),
    tags: String(row[1] ?? ""),
  }));
}

function mapAnkiRowToCard(
  row: { deckId: string; fields: string; modelId: string; order: number; tags: string },
  decks: Record<string, { name: string }>,
  models: Record<string, { name: string; type: number }>,
): ParsedAnkiCard | null {
  const fields = row.fields.split("\u001f");
  const model = models[row.modelId];
  const deckName = normalizeDeckName(decks[row.deckId]?.name ?? "Imported");
  const tags = normalizeTags(row.tags.split(" "));
  const isCloze = model?.type === 1 || model?.name.toLowerCase().includes("cloze");

  if (isCloze) {
    const sourceText = fields[0] ?? "";
    const front = renderClozeCard(sourceText, row.order + 1, "front");
    const back = renderClozeCard(sourceText, row.order + 1, "back");

    if (!front || !back) {
      return null;
    }

    return { back, deckName, front, tags };
  }

  const firstField = htmlToPlainText(fields[0] ?? "");
  const secondField = htmlToPlainText(fields[1] ?? "");

  if (model?.name.toLowerCase().includes("reversed") && row.order === 1 && secondField) {
    return {
      back: firstField,
      deckName,
      front: secondField,
      tags,
    };
  }

  const front = firstField;
  const back = secondField || htmlToPlainText(fields.slice(1).join("\n\n"));

  if (!front || !back) {
    return null;
  }

  return { back, deckName, front, tags };
}

function normalizeDeckName(value: string) {
  const flattened = value
    .split("::")
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1) ?? "Imported";

  return normalizeSpaceName(flattened);
}

function normalizeSpaceName(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "Imported";
  }

  const characters = Array.from(trimmed);
  return characters.length > SPACE_NAME_MAX_LENGTH
    ? characters.slice(0, SPACE_NAME_MAX_LENGTH).join("")
    : trimmed;
}

function renderClozeCard(sourceText: string, clozeIndex: number, mode: "front" | "back") {
  return htmlToPlainText(
    sourceText.replace(CLOZE_PATTERN, (_, rawIndex: string, answer: string, hint: string) => {
      const normalizedAnswer = answer ?? "";
      const normalizedHint = hint ?? "";

      if (mode === "back") {
        return normalizedAnswer;
      }

      if (Number(rawIndex) === clozeIndex) {
        return normalizedHint ? `[${normalizedHint}]` : "[...]";
      }

      return normalizedAnswer;
    }),
  );
}

function htmlToPlainText(html: string) {
  const normalizedMarkup = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|section|article|li|ul|ol|h\d)>/gi, "\n")
    .replace(/<li>/gi, "- ");
  const document = new DOMParser().parseFromString(`<div>${normalizedMarkup}</div>`, "text/html");
  const text = document.body.textContent ?? "";

  return text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseDeckMap(raw: Record<string, unknown>) {
  const decks: Record<string, { name: string }> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") {
      continue;
    }

    const name = typeof (value as { name?: unknown }).name === "string"
      ? ((value as { name: string }).name)
      : "Imported";

    decks[key] = { name };
  }

  return decks;
}

function parseModelMap(raw: Record<string, unknown>) {
  const models: Record<string, { name: string; type: number }> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") {
      continue;
    }

    const candidate = value as { name?: unknown; type?: unknown };
    models[key] = {
      name: typeof candidate.name === "string" ? candidate.name : "",
      type: typeof candidate.type === "number" ? candidate.type : 0,
    };
  }

  return models;
}

function importAnkiCardsInWebStorage(input: ImportAnkiPayload) {
  const spaces = readStoredWebSpaces();
  const cards = readStoredWebCards();
  const now = Date.now();
  const spacesByName = new Map(spaces.map((space) => [normalizeAsciiLower(space.name), space]));
  const cardsBySpace = new Map<string, Set<string>>();
  let createdSpaceCount = 0;
  const targetSpace =
    input.targetSpaceId !== null && input.targetSpaceId !== undefined
      ? spaces.find((space) => space.id === input.targetSpaceId) ?? null
      : null;

  if (input.targetSpaceId && !targetSpace) {
    return Promise.reject(new Error("Target space not found."));
  }

  for (const space of spaces) {
    cardsBySpace.set(
      space.id,
      new Set(
        cards
          .filter((card) => card.spaceId === space.id)
          .map((card) => cardPairKey(card.front, card.back)),
      ),
    );
  }

  const deckStats = new Map<string, ImportDeckResult>();

  for (const card of input.cards) {
    const normalizedDeckName = normalizeSpaceName(card.deckName);
    const deckKey = normalizeAsciiLower(normalizedDeckName);
    let destinationSpace = targetSpace ?? spacesByName.get(deckKey);

    if (!destinationSpace) {
      destinationSpace = {
        createdAt: now,
        id: createWebId("space"),
        name: normalizedDeckName,
        updatedAt: now,
      };
      spaces.push(destinationSpace);
      spacesByName.set(deckKey, destinationSpace);
      cardsBySpace.set(destinationSpace.id, new Set());
      createdSpaceCount += 1;
    }

    const stats =
      deckStats.get(deckKey) ??
      {
        deckName: normalizedDeckName,
        importedCount: 0,
        skippedCount: 0,
        spaceId: destinationSpace.id,
        spaceName: destinationSpace.name,
        totalCount: 0,
      };

    stats.totalCount += 1;
    const cardKey = cardPairKey(card.front, card.back);
    const existingCards = cardsBySpace.get(destinationSpace.id) ?? new Set<string>();

    if (existingCards.has(cardKey)) {
      stats.skippedCount += 1;
      deckStats.set(deckKey, stats);
      continue;
    }

    cards.push({
      back: card.back,
      createdAt: now,
      due: now,
      front: card.front,
      id: createWebId("card"),
      source: "anki",
      spaceId: destinationSpace.id,
      state: 0,
      tags: normalizeTags(card.tags),
      updatedAt: now,
    });
    existingCards.add(cardKey);
    cardsBySpace.set(destinationSpace.id, existingCards);
    destinationSpace.updatedAt = now;
    stats.importedCount += 1;
    deckStats.set(deckKey, stats);
  }

  writeStoredWebSpaces(spaces);
  writeStoredWebCards(cards);

  const decks = [...deckStats.values()].sort((left, right) => left.deckName.localeCompare(right.deckName));
  const importedCount = decks.reduce((sum, deck) => sum + deck.importedCount, 0);
  const duplicateCount = decks.reduce((sum, deck) => sum + deck.skippedCount, 0);

  return Promise.resolve({
    createdSpaceCount,
    deckCount: decks.length,
    decks,
    duplicateCount,
    importedCount,
    targetSpaceId: targetSpace?.id ?? null,
    targetSpaceName: targetSpace?.name ?? null,
  });
}

function writeImportHistory(history: ImportExecutionResult[]) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(
    IMPORT_HISTORY_STORAGE_KEY,
    JSON.stringify(history.slice(0, 12)),
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
    return Array.isArray(parsed) ? parsed.filter(isStoredWebSpace) : [];
  } catch {
    return [];
  }
}

function writeStoredWebSpaces(spaces: StoredWebSpace[]) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(
    WEB_SPACE_STORAGE_KEY,
    JSON.stringify(
      [...spaces].sort(
        (left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt,
      ),
    ),
  );
}

function readStoredWebCards(): StoredWebCard[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  const raw = window.localStorage.getItem(WEB_CARD_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isStoredWebCard) : [];
  } catch {
    return [];
  }
}

function writeStoredWebCards(cards: StoredWebCard[]) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(WEB_CARD_STORAGE_KEY, JSON.stringify(cards));
}

function normalizeTags(tags: string[]) {
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

function normalizeAsciiLower(value: string) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

function cardPairKey(front: string, back: string) {
  return `${front}\u001f${back}`;
}

function createWebId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function isStoredWebSpace(value: unknown): value is StoredWebSpace {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredWebSpace>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.createdAt === "number" &&
    typeof candidate.updatedAt === "number"
  );
}

function isStoredWebCard(value: unknown): value is StoredWebCard {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredWebCard>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.spaceId === "string" &&
    typeof candidate.front === "string" &&
    typeof candidate.back === "string" &&
    Array.isArray(candidate.tags) &&
    typeof candidate.source === "string" &&
    typeof candidate.state === "number" &&
    typeof candidate.due === "number" &&
    typeof candidate.createdAt === "number" &&
    typeof candidate.updatedAt === "number"
  );
}

function isImportExecutionResult(value: unknown): value is ImportExecutionResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ImportExecutionResult>;
  return (
    typeof candidate.sourceFileName === "string" &&
    typeof candidate.importedAt === "number" &&
    typeof candidate.fileSize === "number" &&
    typeof candidate.importedCount === "number" &&
    typeof candidate.duplicateCount === "number" &&
    typeof candidate.deckCount === "number" &&
    typeof candidate.createdSpaceCount === "number" &&
    typeof candidate.parsedCardCount === "number" &&
    Array.isArray(candidate.decks) &&
    (candidate.status === "complete" || candidate.status === "partial") &&
    typeof candidate.statusLabel === "string" &&
    (typeof candidate.targetSpaceId === "undefined" ||
      candidate.targetSpaceId === null ||
      typeof candidate.targetSpaceId === "string") &&
    (typeof candidate.targetSpaceName === "undefined" ||
      candidate.targetSpaceName === null ||
      typeof candidate.targetSpaceName === "string")
  );
}
