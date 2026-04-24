import styles from "./Import.module.css";
import { FileSuccessIcon, ViewIcon } from "./ImportIcons";
import type { ImportSummaryModel } from "./types";

type ImportSummaryCardProps = {
  model: ImportSummaryModel;
  onOpenCards: () => void;
  onStudyNow: () => void;
};

export function ImportSummaryCard({ model, onOpenCards, onStudyNow }: ImportSummaryCardProps) {
  return (
    <div className={styles.importSummary}>
      <div className={styles.importSummaryTop}>
        <div className={styles.importSummaryLeft}>
          <div className={styles.importFileIcon}>
            <FileSuccessIcon />
          </div>
          <div>
            <div className={styles.importSummaryHeadline}>{model.fileName}</div>
            <div className={styles.importSummaryMeta}>{model.metaLabel}</div>
          </div>
        </div>

        <div className={styles.importSummaryActions}>
          <button className={styles.importSummaryBtn} onClick={onOpenCards} type="button">
            <ViewIcon />
            View cards
          </button>
          <button
            className={`${styles.importSummaryBtn} ${styles.primary}`}
            onClick={onStudyNow}
            type="button"
          >
            Study now →
          </button>
        </div>
      </div>

      <div className={styles.deckBreakdown}>
        <div className={styles.deckBreakdownHeader}>
          <span>{model.breakdownLabel ?? "Deck → Space"}</span>
          <span className={styles.colRight}>Imported</span>
          <span className={styles.colRight}>Skipped</span>
          <span className={styles.colRight}>Total</span>
        </div>

        {model.deckBreakdown.map((deck) => (
          <div className={styles.deckRow} key={deck.deckName}>
            <span className={styles.deckName}>{deck.deckName}</span>
            <span className={`${styles.deckVal} ${styles.imported}`}>{deck.importedCount}</span>
            <span className={styles.deckVal}>{deck.skippedCount}</span>
            <span className={styles.deckVal}>{deck.totalCount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
