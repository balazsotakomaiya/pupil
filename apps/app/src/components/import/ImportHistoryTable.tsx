import type { ImportHistoryItem } from "./types";

type ImportHistoryTableProps = {
  items: ImportHistoryItem[];
};

export function ImportHistoryTable({ items }: ImportHistoryTableProps) {
  return (
    <div className="history-table">
      {items.map((item) => (
        <div className="history-row" key={`${item.fileName}-${item.dateLabel}`}>
          <span className="history-file">{item.fileName}</span>
          <span className="history-date">{item.dateLabel}</span>
          <span className="history-cards">{item.cardsImported}</span>
          <span className="history-dupes">{item.duplicateCount}</span>
          <span className={`history-status ${item.status}`}>{item.statusLabel}</span>
        </div>
      ))}
    </div>
  );
}
