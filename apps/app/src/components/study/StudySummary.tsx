type StudySummaryProps = {
  backLabel: string;
  nextDueLabel: string;
  onBack: () => void;
  onRestart: () => void;
  retention: number;
  reviewedCount: number;
  streakLabel: string;
  subtitle: string;
  title: string;
  totalMinutes: number;
};

export function StudySummary({
  backLabel,
  nextDueLabel,
  onBack,
  onRestart,
  retention,
  reviewedCount,
  streakLabel,
  subtitle,
  title,
  totalMinutes,
}: StudySummaryProps) {
  return (
    <div className="session-summary-screen visible">
      <div className="session-summary-check">
        <SummaryCheckIcon />
      </div>
      <div className="session-summary-title">{title}</div>
      <div className="session-summary-sub">{subtitle}</div>

      <div className="session-summary-stats">
        <div className="session-summary-stat">
          <div className="session-summary-stat-value">{reviewedCount}</div>
          <div className="session-summary-stat-label">Reviewed</div>
        </div>
        <div className="session-summary-stat">
          <div className="session-summary-stat-value">
            {retention}
            <span className="unit">%</span>
          </div>
          <div className="session-summary-stat-label">Retention</div>
        </div>
        <div className="session-summary-stat">
          <div className="session-summary-stat-value">
            {totalMinutes}
            <span className="unit">m</span>
          </div>
          <div className="session-summary-stat-label">Duration</div>
        </div>
      </div>

      <div className="session-summary-streak">
        <span className="session-summary-streak-dot" />
        <span className="session-summary-streak-text">{streakLabel}</span>
      </div>

      <div className="session-summary-actions">
        <button className="session-summary-btn" onClick={onRestart} type="button">
          Study again
        </button>
        <button className="session-summary-btn primary" onClick={onBack} type="button">
          {backLabel}
        </button>
      </div>

      <div className="session-summary-next-due">{nextDueLabel}</div>
    </div>
  );
}

function SummaryCheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}
