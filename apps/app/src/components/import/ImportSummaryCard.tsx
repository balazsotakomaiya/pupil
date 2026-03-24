import { FileSuccessIcon, ViewIcon } from "./ImportIcons";
import type { ImportSummaryModel } from "./types";

type ImportSummaryCardProps = {
  model: ImportSummaryModel;
  onOpenCards: () => void;
  onStudyNow: () => void;
};

export function ImportSummaryCard({ model, onOpenCards, onStudyNow }: ImportSummaryCardProps) {
  return (
    <div className="import-summary">
      <div className="import-summary-top">
        <div className="import-summary-left">
          <div className="import-file-icon">
            <FileSuccessIcon />
          </div>
          <div>
            <div className="import-summary-headline">{model.fileName}</div>
            <div className="import-summary-meta">{model.metaLabel}</div>
          </div>
        </div>

        <div className="import-summary-actions">
          <button className="import-summary-btn" onClick={onOpenCards} type="button">
            <ViewIcon />
            View cards
          </button>
          <button className="import-summary-btn primary" onClick={onStudyNow} type="button">
            Study now →
          </button>
        </div>
      </div>

      <div className="deck-breakdown">
        <div className="deck-breakdown-header">
          <span>Deck → Space</span>
          <span className="col-right">Imported</span>
          <span className="col-right">Skipped</span>
          <span className="col-right">Total</span>
        </div>

        {model.deckBreakdown.map((deck) => (
          <div className="deck-row" key={deck.deckName}>
            <span className="deck-name">{deck.deckName}</span>
            <span className="deck-val imported">{deck.importedCount}</span>
            <span className="deck-val">{deck.skippedCount}</span>
            <span className="deck-val">{deck.totalCount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
