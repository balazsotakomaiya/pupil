import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { importApkgFile, readImportHistory, type ImportExecutionResult } from "../../lib/imports";
import { ImportDropZone } from "./ImportDropZone";
import { ImportHistoryTable } from "./ImportHistoryTable";
import { ImportNotesCard } from "./ImportNotesCard";
import { ImportProgressCard } from "./ImportProgressCard";
import { ImportSummaryCard } from "./ImportSummaryCard";
import type { ImportHistoryItem, ImportProgressModel, ImportSummaryModel } from "./types";

type ImportScreenProps = {
  onImportComplete: () => Promise<void>;
  onOpenCards: () => void;
  onStudyNow: () => void;
};

const IMPORT_NOTES = [
  "Each Anki deck becomes a separate Pupil space. Nested decks are flattened.",
  "Cards are mapped from Anki's note types. Basic uses <code>field[0]</code> → front, <code>field[1]</code> → back. Cloze syntax is converted automatically.",
  "All cards start fresh with FSRS-5 scheduling. Anki review history is not transferred.",
  "Duplicate detection compares front and back text against existing cards in the target space.",
  "Images and audio embedded in <code>.apkg</code> files are skipped for now. HTML is stripped to plain text.",
  "Re-importing the same file is safe. Duplicates are detected and skipped.",
];

export function ImportScreen({
  onImportComplete,
  onOpenCards,
  onStudyNow,
}: ImportScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const storedHistory = useMemo(() => readImportHistory(), []);
  const [activeImportModel, setActiveImportModel] = useState<ImportProgressModel | null>(() =>
    storedHistory[0] ? buildCompletedProgressModel(storedHistory[0]) : null,
  );
  const [lastImportModel, setLastImportModel] = useState<ImportSummaryModel | null>(() =>
    storedHistory[0] ? buildSummaryModel(storedHistory[0]) : null,
  );
  const [historyItems, setHistoryItems] = useState<ImportHistoryItem[]>(() =>
    storedHistory.map(buildHistoryItem),
  );

  function handleBrowse() {
    fileInputRef.current?.click();
  }

  async function handleImport(file: File | null) {
    setIsDragOver(false);

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".apkg")) {
      setActiveImportModel(buildUnsupportedModel(file, "Only .apkg files are supported"));
      return;
    }

    try {
      const result = await importApkgFile(file, setActiveImportModel);
      setLastImportModel(buildSummaryModel(result));
      const nextHistory = readImportHistory();
      setHistoryItems(nextHistory.map(buildHistoryItem));
      await onImportComplete();
    } catch (error: unknown) {
      setActiveImportModel(
        buildUnsupportedModel(
          file,
          error instanceof Error ? error.message : "Failed to import the selected package",
        ),
      );
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    void handleImport(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDragOver(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void handleImport(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div className="page import-page">
      <ImportDropZone
        fileInputRef={fileInputRef}
        isDragOver={isDragOver}
        onBrowse={handleBrowse}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onFileChange={handleFileChange}
      />

      {activeImportModel ? (
        <>
          <div className="ruler-divider" />

          <section className="section import-section-tight">
            <div className="section-head">
              <span className="section-label">Active Import</span>
            </div>

            <div className="import-states">
              <ImportProgressCard model={activeImportModel} />
            </div>
          </section>
        </>
      ) : null}

      {lastImportModel ? (
        <>
          <div className="ruler-divider" />

          <section className="section import-section-tight">
            <div className="section-head">
              <span className="section-label">Last Import</span>
            </div>

            <ImportSummaryCard
              model={lastImportModel}
              onOpenCards={onOpenCards}
              onStudyNow={onStudyNow}
            />
          </section>
        </>
      ) : null}

      {historyItems.length > 0 ? (
        <>
          <div className="ruler-divider" />

          <section className="section">
            <div className="section-head">
              <span className="section-label">History</span>
            </div>

            <ImportHistoryTable items={historyItems} />
          </section>
        </>
      ) : null}

      <div className="ruler-divider" />

      <section className="notes-section">
        <ImportNotesCard items={IMPORT_NOTES} />
      </section>

      <div className="page-end" />
    </div>
  );
}

function buildSummaryModel(result: ImportExecutionResult): ImportSummaryModel {
  return {
    deckBreakdown: result.decks.map((deck) => ({
      deckName: deck.deckName,
      importedCount: deck.importedCount,
      skippedCount: deck.skippedCount,
      totalCount: deck.totalCount,
    })),
    fileName: result.sourceFileName,
    metaLabel: `Imported ${formatRelativeTime(result.importedAt)} · ${formatFileSize(result.fileSize)}`,
  };
}

function buildHistoryItem(result: ImportExecutionResult): ImportHistoryItem {
  return {
    cardsImported: result.importedCount,
    dateLabel: formatHistoryDate(result.importedAt),
    duplicateCount: result.duplicateCount,
    fileName: result.sourceFileName,
    status: result.status,
    statusLabel: result.statusLabel,
  };
}

function buildCompletedProgressModel(result: ImportExecutionResult): ImportProgressModel {
  return {
    details: [
      { accent: "success", label: "cards imported", value: formatNumber(result.importedCount) },
      { label: "duplicates skipped", value: formatNumber(result.duplicateCount) },
      { label: "decks touched", value: formatNumber(result.deckCount) },
    ],
    fileName: result.sourceFileName,
    fileSubtext: `${formatFileSize(result.fileSize)} · imported ${formatRelativeTime(result.importedAt)}`,
    progress: 100,
    statusLabel: "Complete",
    statusVariant: "complete",
  };
}

function buildUnsupportedModel(file: File, message: string): ImportProgressModel {
  return {
    details: [
      { label: "file selected", value: formatFileSize(file.size) },
      { label: "supported format", value: ".apkg only" },
      { label: "status", value: message },
    ],
    fileName: file.name,
    fileSubtext: `${formatFileSize(file.size)} · import failed`,
    progress: 100,
    statusLabel: "Error",
    statusVariant: "error",
  };
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

function formatRelativeTime(timestamp: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / (60 * 1000)));

  if (minutes < 60) {
    return minutes <= 1 ? "just now" : `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  }).format(timestamp);
}

function formatHistoryDate(timestamp: number) {
  const hours = Math.floor((Date.now() - timestamp) / (60 * 60 * 1000));

  if (hours < 24) {
    return formatRelativeTime(timestamp);
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  }).format(timestamp);
}
