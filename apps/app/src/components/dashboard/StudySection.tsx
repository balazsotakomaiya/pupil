import type { StudySummary } from "./types";

type StudySectionProps = {
  onPrimaryAction?: () => void;
  summary: StudySummary;
};

export function StudySection({ onPrimaryAction, summary }: StudySectionProps) {
  return (
    <section className="study-section">
      <div className="study-card">
        <div className="study-left">
          <div className="study-eyebrow">
            <span className="live-dot" />
            {summary.eyebrow}
          </div>
          <div className="study-headline">{summary.headline}</div>
          <div className="study-sub">{summary.description}</div>
          {summary.breakdown.length > 0 ? (
            <div className="study-breakdown">
              {summary.breakdown.map((item) => (
                <span className="study-breakdown-item" key={item.label}>
                  <strong>{item.value}</strong> {item.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="study-right">
          <button className="study-btn-secondary" type="button">
            {summary.secondaryActionLabel}
          </button>
          <button className="study-btn" onClick={onPrimaryAction} type="button">
            {summary.primaryActionLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
