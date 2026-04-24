import styles from "./Import.module.css";
import type { ImportHistoryItem } from "./types";

type ImportHistoryTableProps = {
  items: ImportHistoryItem[];
};

export function ImportHistoryTable({ items }: ImportHistoryTableProps) {
  return (
    <div className={styles.historyTable}>
      {items.map((item) => (
        <div className={styles.historyRow} key={`${item.fileName}-${item.dateLabel}`}>
          <span className={styles.historyFile}>{item.fileName}</span>
          <span className={styles.historyDate}>{item.dateLabel}</span>
          <span className={styles.historyCards}>{item.cardsImported}</span>
          <span className={styles.historyDupes}>{item.duplicateCount}</span>
          <span className={`${styles.historyStatus} ${styles[item.status]}`}>
            {item.statusLabel}
          </span>
        </div>
      ))}
    </div>
  );
}
