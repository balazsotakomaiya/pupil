import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { ImportDropZone } from "./ImportDropZone";
import { ImportHistoryTable } from "./ImportHistoryTable";
import { ImportNotesCard } from "./ImportNotesCard";
import { ImportProgressCard } from "./ImportProgressCard";
import { ImportSummaryCard } from "./ImportSummaryCard";
import type {
  ImportDeckBreakdownItem,
  ImportHistoryItem,
  ImportProgressModel,
} from "./types";

type ImportScreenProps = {
  onOpenCards: () => void;
  onStudyNow: () => void;
};

const LAST_IMPORT_BREAKDOWN: ImportDeckBreakdownItem[] = [
  { deckName: "Amino Acids", imported: 62, skipped: 3, total: 65 },
  { deckName: "Enzyme Kinetics", imported: 48, skipped: 0, total: 48 },
  { deckName: "Metabolic Pathways", imported: 35, skipped: 12, total: 47 },
];

const IMPORT_HISTORY: ImportHistoryItem[] = [
  {
    cards: 145,
    dateLabel: "3h ago",
    duplicateCount: 15,
    fileName: "biochemistry_complete.apkg",
    status: "complete",
    statusLabel: "complete",
  },
  {
    cards: 312,
    dateLabel: "Mar 20",
    duplicateCount: 0,
    fileName: "world_history_ap.apkg",
    status: "complete",
    statusLabel: "complete",
  },
  {
    cards: 89,
    dateLabel: "Mar 18",
    duplicateCount: 4,
    fileName: "french_vocab_b2.apkg",
    status: "complete",
    statusLabel: "complete",
  },
  {
    cards: 0,
    dateLabel: "Mar 15",
    duplicateCount: 0,
    fileName: "organic_chem_reactions.apkg",
    status: "partial",
    statusLabel: "corrupt file",
  },
  {
    cards: 89,
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

export function ImportScreen({ onOpenCards, onStudyNow }: ImportScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileError, setSelectedFileError] = useState<string | null>(null);

  const activeImportModel = buildActiveImportModel(selectedFile, selectedFileError);

  function handleBrowse() {
    fileInputRef.current?.click();
  }

  function handleFileSelection(file: File | null) {
    setIsDragOver(false);

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".apkg")) {
      setSelectedFile(file);
      setSelectedFileError("Only .apkg files are supported");
      return;
    }

    setSelectedFile(file);
    setSelectedFileError(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    handleFileSelection(event.target.files?.[0] ?? null);
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
    handleFileSelection(event.dataTransfer.files?.[0] ?? null);
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
          deckBreakdown={LAST_IMPORT_BREAKDOWN}
          onOpenCards={onOpenCards}
          onStudyNow={onStudyNow}
        />
      </section>

      <div className="ruler-divider" />

      <section className="section">
        <div className="section-head">
          <span className="section-label">History</span>
        </div>

        <ImportHistoryTable items={IMPORT_HISTORY} />
      </section>

      <div className="ruler-divider" />

      <section className="notes-section">
        <ImportNotesCard items={IMPORT_NOTES} />
      </section>

      <div className="page-end" />
    </div>
  );
}

function buildActiveImportModel(
  selectedFile: File | null,
  selectedFileError: string | null,
): ImportProgressModel {
  if (!selectedFile) {
    return FALLBACK_ACTIVE_IMPORT;
  }

  if (selectedFileError) {
    return {
      details: [
        { label: "file selected", value: formatFileSize(selectedFile.size) },
        { label: "supported format", value: ".apkg only" },
        { label: "status", value: selectedFileError },
      ],
      fileName: selectedFile.name,
      fileSubtext: `${formatFileSize(selectedFile.size)} · unsupported file type`,
      progress: 100,
      statusLabel: "Unsupported",
      statusVariant: "error",
    };
  }

  return {
    details: [
      { label: "file selected", value: formatFileSize(selectedFile.size) },
      { label: "import mode", value: "text only" },
      { accent: "success", label: "target scheduler", value: "FSRS-5" },
    ],
    fileName: selectedFile.name,
    fileSubtext: `${formatFileSize(selectedFile.size)} · awaiting parser`,
    progress: 12,
    statusLabel: "Queued",
    statusVariant: "queued",
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
