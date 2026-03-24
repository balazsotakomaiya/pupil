import { FileSuccessIcon, ViewIcon } from "./ImportIcons";
import type { ImportDeckBreakdownItem } from "./types";

type ImportSummaryCardProps = {
  deckBreakdown: ImportDeckBreakdownItem[];
  onOpenCards: () => void;
  onStudyNow: () => void;
};

export function ImportSummaryCard({
  deckBreakdown,
  onOpenCards,
  onStudyNow,
}: ImportSummaryCardProps) {
  return (
    <div className="import-summary">
      <div className="import-summary-top">
        <div className="import-summary-left">
          <div className="import-file-icon">
            <FileSuccessIcon />
          </div>
          <div>
            <div className="import-summary-headline">biochemistry_complete.apkg</div>
            <div className="import-summary-meta">Imported 3 hours ago · 2.8 MB</div>
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

        {deckBreakdown.map((deck) => (
          <div className="deck-row" key={deck.deckName}>
            <span className="deck-name">{deck.deckName}</span>
            <span className="deck-val imported">{deck.imported}</span>
            <span className="deck-val">{deck.skipped}</span>
            <span className="deck-val">{deck.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
