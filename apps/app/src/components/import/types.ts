export type ImportDeckBreakdownItem = {
  deckName: string;
  imported: number;
  skipped: number;
  total: number;
};

export type ImportHistoryItem = {
  cards: number;
  dateLabel: string;
  duplicateCount: number;
  fileName: string;
  status: "complete" | "partial";
  statusLabel: string;
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
