import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { importApkgFile, readImportHistory, type ImportExecutionResult } from "../../lib/imports";
import type { SpaceSummary } from "../../lib/spaces";
import { ImportDropZone } from "./ImportDropZone";
import { ChevronDownIcon } from "./ImportIcons";
import { ImportHistoryTable } from "./ImportHistoryTable";
import { ImportNotesCard } from "./ImportNotesCard";
import { ImportProgressCard } from "./ImportProgressCard";
import { ImportSummaryCard } from "./ImportSummaryCard";
import type { ImportHistoryItem, ImportProgressModel, ImportSummaryModel } from "./types";
import { ImportTitlebar } from "./ImportTitlebar";

type ImportScreenProps = {
  backLabel?: string;
  onImportComplete: () => Promise<void>;
  onOpenCards: () => void;
  onBack?: () => void;
  onStudyNow: () => void;
  spaces?: SpaceSummary[];
  targetSpaceId?: string | null;
  targetSpaceName?: string | null;
};

const GLOBAL_IMPORT_NOTES = [
  "Each Anki deck becomes a separate Pupil space. Nested decks are flattened.",
  "Cards are mapped from Anki's note types. Basic uses <code>field[0]</code> → front, <code>field[1]</code> → back. Cloze syntax is converted automatically.",
  "All cards start fresh with FSRS-5 scheduling. Anki review history is not transferred.",
  "Duplicate detection compares front and back text against existing cards in the target space.",
  "Images and audio embedded in <code>.apkg</code> files are skipped for now. HTML is stripped to plain text.",
  "Re-importing the same file is safe. Duplicates are detected and skipped.",
];

const TARGETED_IMPORT_NOTES = [
  "All imported cards are merged into this space. Original Anki deck boundaries are used for parsing and reporting, but not for creating new spaces.",
  "Cards are mapped from Anki's note types. Basic uses <code>field[0]</code> → front, <code>field[1]</code> → back. Cloze syntax is converted automatically.",
  "Duplicate detection compares front and back text against cards already in this space, plus cards imported earlier in the same run.",
  "All cards start fresh with FSRS-5 scheduling. Anki review history is not transferred.",
  "Images and audio embedded in <code>.apkg</code> files are skipped for now. HTML is stripped to plain text.",
  "Re-importing the same file is safe. Duplicates are detected and skipped.",
];

export function ImportScreen({
  backLabel,
  onImportComplete,
  onOpenCards,
  onBack,
  onStudyNow,
  spaces,
  targetSpaceId = null,
  targetSpaceName = null,
}: ImportScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

  const effectiveTargetSpaceId = targetSpaceId ?? selectedSpaceId;
  const effectiveTargetSpaceName =
    targetSpaceName ??
    (selectedSpaceId ? (spaces?.find((s) => s.id === selectedSpaceId)?.name ?? null) : null);

  const storedHistory = useMemo(() => readImportHistory(), []);
  const visibleHistory = useMemo(
    () =>
      targetSpaceId
        ? storedHistory.filter((entry) => entry.targetSpaceId === targetSpaceId)
        : storedHistory,
    [storedHistory, targetSpaceId],
  );
  const importNotes = effectiveTargetSpaceId ? TARGETED_IMPORT_NOTES : GLOBAL_IMPORT_NOTES;
  const [activeImportModel, setActiveImportModel] = useState<ImportProgressModel | null>(null);
  const [lastImportModel, setLastImportModel] = useState<ImportSummaryModel | null>(() =>
    visibleHistory[0] ? buildSummaryModel(visibleHistory[0]) : null,
  );
  const [historyItems, setHistoryItems] = useState<ImportHistoryItem[]>(() =>
    visibleHistory.map(buildHistoryItem),
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
      console.warn("[import] Rejected non-apkg file", {
        fileName: file.name,
        fileSize: file.size,
      });
      setLastImportModel(null);
      setActiveImportModel(buildUnsupportedModel(file, "Only .apkg files are supported"));
      return;
    }

    try {
      setLastImportModel(null);
      const result = await importApkgFile(file, {
        onStageChange: setActiveImportModel,
        targetSpaceId: effectiveTargetSpaceId,
      });
      setLastImportModel(buildSummaryModel(result));
      const nextHistory = targetSpaceId
        ? readImportHistory().filter((entry) => entry.targetSpaceId === targetSpaceId)
        : readImportHistory();
      setHistoryItems(nextHistory.map(buildHistoryItem));
      await onImportComplete();
    } catch (error: unknown) {
      console.error("[import] Import screen received failure", {
        error,
        fileName: file.name,
      });
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
    <>
      {onBack && backLabel ? <ImportTitlebar backLabel={backLabel} onBack={onBack} /> : null}

      <div className="page import-page">
        <section className="import-hero">
          {!targetSpaceId && spaces && spaces.length > 0 ? (
            <div className="import-target">
              <label className="import-target-label" htmlFor="import-target-space">
                Import into
              </label>
              <div className="import-target-select-wrap">
                <select
                  className="import-target-select"
                  id="import-target-space"
                  onChange={(e) => setSelectedSpaceId(e.target.value || null)}
                  value={selectedSpaceId ?? ""}
                >
                  <option value="">Create spaces from deck names</option>
                  {spaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.name}
                    </option>
                  ))}
                </select>
                <div className="import-target-chevron">
                  <ChevronDownIcon />
                </div>
              </div>
              <div className="import-target-hint">
                {selectedSpaceId
                  ? "All imported cards will be merged into this space."
                  : "Each Anki deck will become a separate Pupil space."}
              </div>
            </div>
          ) : null}
          <ImportDropZone
            fileInputRef={fileInputRef}
            isDragOver={isDragOver}
            onBrowse={handleBrowse}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onFileChange={handleFileChange}
            targetSpaceName={effectiveTargetSpaceName}
          />
        </section>

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
          <ImportNotesCard items={importNotes} />
        </section>

        <div className="page-end" />
      </div>
    </>
  );
}

function buildSummaryModel(result: ImportExecutionResult): ImportSummaryModel {
  return {
    breakdownLabel: result.targetSpaceName ? "Source Deck" : "Deck → Space",
    deckBreakdown: result.decks.map((deck) => ({
      deckName: deck.deckName,
      importedCount: deck.importedCount,
      skippedCount: deck.skippedCount,
      totalCount: deck.totalCount,
    })),
    fileName: result.sourceFileName,
    metaLabel: result.targetSpaceName
      ? `Imported into ${result.targetSpaceName} · ${formatRelativeTime(result.importedAt)} · ${formatFileSize(result.fileSize)}`
      : `Imported ${formatRelativeTime(result.importedAt)} · ${formatFileSize(result.fileSize)}`,
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
