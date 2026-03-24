export type ImportDeckBreakdownItem = {
  deckName: string;
  importedCount: number;
  skippedCount: number;
  totalCount: number;
};

export type ImportHistoryItem = {
  cardsImported: number;
  dateLabel: string;
  duplicateCount: number;
  fileName: string;
  status: "complete" | "partial";
  statusLabel: string;
};

export type ImportSummaryModel = {
  deckBreakdown: ImportDeckBreakdownItem[];
  fileName: string;
  metaLabel: string;
};

export type ImportStatusVariant = "parsing" | "complete" | "error" | "queued";

export type ImportProgressModel = {
  details: Array<{
    accent?: "success";
    label: string;
    value: string;
  }>;
  fileName: string;
  fileSubtext: string;
  progress: number;
  statusLabel: string;
  statusVariant: ImportStatusVariant;
};
