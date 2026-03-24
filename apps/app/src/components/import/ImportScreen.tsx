import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { importApkgFile, readImportHistory, type ImportExecutionResult } from "../../lib/imports";
import { ImportDropZone } from "./ImportDropZone";
import { ImportHistoryTable } from "./ImportHistoryTable";
import { ImportNotesCard } from "./ImportNotesCard";
import { ImportProgressCard } from "./ImportProgressCard";
import { ImportSummaryCard } from "./ImportSummaryCard";
import type {
  ImportHistoryItem,
  ImportProgressModel,
  ImportSummaryModel,
} from "./types";

type ImportScreenProps = {
  onImportComplete: () => Promise<void>;
  onOpenCards: () => void;
  onStudyNow: () => void;
};

const FALLBACK_SUMMARY: ImportSummaryModel = {
  deckBreakdown: [
    { deckName: "Amino Acids", importedCount: 62, skippedCount: 3, totalCount: 65 },
    { deckName: "Enzyme Kinetics", importedCount: 48, skippedCount: 0, totalCount: 48 },
    { deckName: "Metabolic Pathways", importedCount: 35, skippedCount: 12, totalCount: 47 },
  ],
  fileName: "biochemistry_complete.apkg",
  metaLabel: "Imported 3 hours ago · 2.8 MB",
};

const FALLBACK_HISTORY: ImportHistoryItem[] = [
  {
    cardsImported: 145,
    dateLabel: "3h ago",
    duplicateCount: 15,
    fileName: "biochemistry_complete.apkg",
    status: "complete",
    statusLabel: "complete",
  },
  {
    cardsImported: 312,
    dateLabel: "Mar 20",
    duplicateCount: 0,
    fileName: "world_history_ap.apkg",
    status: "complete",
    statusLabel: "complete",
  },
  {
    cardsImported: 89,
    dateLabel: "Mar 18",
    duplicateCount: 4,
    fileName: "french_vocab_b2.apkg",
    status: "complete",
    statusLabel: "complete",
  },
  {
    cardsImported: 0,
    dateLabel: "Mar 15",
    duplicateCount: 0,
    fileName: "organic_chem_reactions.apkg",
    status: "partial",
    statusLabel: "corrupt file",
  },
  {
    cardsImported: 89,
    dateLabel: "Mar 10",
    duplicateCount: 0,
    fileName: "rust_ownership_basics.apkg",
    status: "complete",
    statusLabel: "complete",
  },
];

const IMPORT_NOTES = [
  "Each Anki deck becomes a separate Pupil space. Nested decks are flattened.",
  "Cards are mapped from Anki's note types. Basic uses <code>field[0]</code> → front, <code>field[1]</code> → back. Cloze syntax is converted automatically.",
  "All cards start fresh with FSRS-5 scheduling. Anki review history is not transferred.",
  "Duplicate detection compares front and back text against existing cards in the target space.",
  "Images and audio embedded in <code>.apkg</code> files are skipped for now. HTML is stripped to plain text.",
  "Re-importing the same file is safe. Duplicates are detected and skipped.",
];

const FALLBACK_ACTIVE_IMPORT: ImportProgressModel = {
  details: [
    { label: "/ 1,847 cards processed", value: "1,203" },
    { label: "decks found", value: "4" },
    { label: "duplicates so far", value: "31" },
  ],
  fileName: "japanese_n3_vocab.apkg",
  fileSubtext: "4.2 MB · 1,847 notes detected",
  progress: 65,
  statusLabel: "Parsing…",
  statusVariant: "parsing",
};

export function ImportScreen({
  onImportComplete,
  onOpenCards,
  onStudyNow,
}: ImportScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const storedHistory = useMemo(() => readImportHistory(), []);
  const [activeImportModel, setActiveImportModel] = useState<ImportProgressModel>(() =>
    storedHistory[0] ? buildCompletedProgressModel(storedHistory[0]) : FALLBACK_ACTIVE_IMPORT,
  );
  const [lastImportModel, setLastImportModel] = useState<ImportSummaryModel>(() =>
    storedHistory[0] ? buildSummaryModel(storedHistory[0]) : FALLBACK_SUMMARY,
  );
  const [historyItems, setHistoryItems] = useState<ImportHistoryItem[]>(() =>
    storedHistory.length > 0 ? storedHistory.map(buildHistoryItem) : FALLBACK_HISTORY,
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
      setHistoryItems(nextHistory.length > 0 ? nextHistory.map(buildHistoryItem) : FALLBACK_HISTORY);
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

      <div className="ruler-divider" />

      <section className="section import-section-tight">
        <div className="section-head">
          <span className="section-label">Active Import</span>
        </div>

        <div className="import-states">
          <ImportProgressCard model={activeImportModel} />
        </div>
      </section>

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

      <div className="ruler-divider" />

      <section className="section">
        <div className="section-head">
          <span className="section-label">History</span>
        </div>

        <ImportHistoryTable items={historyItems} />
      </section>

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
