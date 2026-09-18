import JSZip from "jszip";
import initSqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { describe, expect, it, vi } from "vitest";
import { enableTauriRuntime, invokeMock } from "../test/tauri";
import { listCards } from "./cards";
import { importApkgFile, readImportHistory } from "./imports";
import { listSpaces } from "./spaces";

const historyItem = {
  createdSpaceCount: 1,
  deckCount: 1,
  decks: [
    {
      deckName: "Rust",
      importedCount: 2,
      skippedCount: 0,
      spaceId: "space-a",
      spaceName: "Rust",
      totalCount: 2,
    },
  ],
  duplicateCount: 0,
  fileSize: 12,
  importedAt: 2,
  importedCount: 2,
  parsedCardCount: 2,
  sourceFileName: "rust.apkg",
  status: "complete" as const,
  statusLabel: "complete",
};

async function createBasicApkg() {
  const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl.replace(/^\/@fs/, "") });
  const database = new SQL.Database() as unknown as {
    close(): void;
    exec(sql: string): void;
    export(): Uint8Array;
  };
  database.exec("CREATE TABLE col (decks TEXT, models TEXT)");
  database.exec("CREATE TABLE notes (id INTEGER, mid INTEGER, tags TEXT, flds TEXT)");
  database.exec("CREATE TABLE cards (id INTEGER, nid INTEGER, did INTEGER, ord INTEGER)");
  database.exec(
    `INSERT INTO col VALUES ('{"1":{"name":"Languages::Rust"}}', '{"1":{"name":"Basic","type":0}}')`,
  );
  database.exec("INSERT INTO notes VALUES (1, 1, ' rust  systems ', 'Ownership\u001fRules')");
  database.exec("INSERT INTO cards VALUES (1, 1, 1, 0)");
  const archive = new JSZip();
  archive.file("collection.anki2", database.export());
  database.close();
  const archiveBytes = await archive.generateAsync({ type: "uint8array" });

  return new File([archiveBytes.buffer as ArrayBuffer], "rust.apkg", {
    type: "application/octet-stream",
  });
}

describe("import history", () => {
  it("sorts valid persisted entries and ignores malformed values", () => {
    window.localStorage.setItem(
      "pupil.web.import-history",
      JSON.stringify([
        { ...historyItem, importedAt: 1 },
        historyItem,
        { sourceFileName: "broken" },
      ]),
    );

    expect(readImportHistory()).toEqual([historyItem, { ...historyItem, importedAt: 1 }]);
    window.localStorage.setItem("pupil.web.import-history", "not json");
    expect(readImportHistory()).toEqual([]);
  });
});

describe("APKG input validation", () => {
  it("reports parsing progress then rejects a non-APKG file without persisting history", async () => {
    const onStageChange = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const file = new File(["plain text"], "notes.txt", { type: "text/plain" });

    await expect(importApkgFile(file, { onStageChange })).rejects.toThrow(
      "Only .apkg files are supported.",
    );
    expect(onStageChange).toHaveBeenCalledWith(
      expect.objectContaining({ progress: 12, statusVariant: "parsing" }),
    );
    expect(readImportHistory()).toEqual([]);
  });

  it("imports a basic deck into browser storage with its matching space and history", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const file = await createBasicApkg();

    const first = await importApkgFile(file);

    expect(first).toMatchObject({
      createdSpaceCount: 1,
      deckCount: 1,
      duplicateCount: 0,
      importedCount: 1,
      parsedCardCount: 1,
    });
    const [storedSpace] = await listSpaces();
    const [listedCard] = await listCards();
    expect(listedCard).toMatchObject({
      back: "Rules",
      front: "Ownership",
      source: "anki",
      spaceId: storedSpace.id,
      spaceName: "Rust",
      tags: ["rust", "systems"],
    });
    expect(JSON.parse(window.localStorage.getItem("pupil.web.cards") ?? "[]")).toEqual([
      expect.objectContaining({
        back: "Rules",
        front: "Ownership",
        source: "anki",
        spaceId: storedSpace.id,
        spaceName: "Rust",
        tags: ["rust", "systems"],
      }),
    ]);
    expect(storedSpace).toMatchObject({ name: "Rust", cardCount: 1 });
    expect(readImportHistory()).toEqual([
      expect.objectContaining({ decks: [expect.objectContaining({ spaceName: "Rust" })] }),
    ]);
  });

  it("records duplicate cards when the same APKG is imported twice", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const file = await createBasicApkg();

    await importApkgFile(file);
    await expect(importApkgFile(file)).resolves.toMatchObject({
      duplicateCount: 1,
      importedCount: 0,
    });
    expect(readImportHistory()).toHaveLength(2);
  });

  it("sends parsed Anki cards to the desktop import command", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce({
      createdSpaceCount: 0,
      deckCount: 1,
      decks: [],
      duplicateCount: 0,
      importedCount: 1,
      targetSpaceId: "space-a",
      targetSpaceName: "Rust",
    });

    await expect(
      importApkgFile(await createBasicApkg(), { targetSpaceId: "space-a" }),
    ).resolves.toMatchObject({
      importedCount: 1,
      targetSpaceId: "space-a",
    });
    expect(invokeMock).toHaveBeenCalledWith(
      "import_anki_cards",
      expect.objectContaining({
        input: expect.objectContaining({
          sourceFileName: "rust.apkg",
          targetSpaceId: "space-a",
          cards: [expect.objectContaining({ back: "Rules", deckName: "Rust", front: "Ownership" })],
        }),
      }),
    );
  });
});
