import styles from "./Study.module.css";

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
    <div className={`${styles.sessionSummaryScreen} visible`}>
      <div className={styles.sessionSummaryCheck}>
        <SummaryCheckIcon />
      </div>
      <div className={styles.sessionSummaryTitle}>{title}</div>
      <div className={styles.sessionSummarySub}>{subtitle}</div>

      <div className={styles.sessionSummaryStats}>
        <div className={styles.sessionSummaryStat}>
          <div className={styles.sessionSummaryStatValue}>{reviewedCount}</div>
          <div className={styles.sessionSummaryStatLabel}>Reviewed</div>
        </div>
        <div className={styles.sessionSummaryStat}>
          <div className={styles.sessionSummaryStatValue}>
            {retention}
            <span className="unit">%</span>
          </div>
          <div className={styles.sessionSummaryStatLabel}>Retention</div>
        </div>
        <div className={styles.sessionSummaryStat}>
          <div className={styles.sessionSummaryStatValue}>
            {totalMinutes}
            <span className="unit">m</span>
          </div>
          <div className={styles.sessionSummaryStatLabel}>Duration</div>
        </div>
      </div>

      <div className={styles.sessionSummaryStreak}>
        <span className={styles.sessionSummaryStreakDot} />
        <span className={styles.sessionSummaryStreakText}>{streakLabel}</span>
      </div>

      <div className={styles.sessionSummaryActions}>
        <button className={styles.sessionSummaryBtn} onClick={onRestart} type="button">
          Study again
        </button>
        <button
          className={`${styles.sessionSummaryBtn} ${styles.primary}`}
          onClick={onBack}
          type="button"
        >
          {backLabel}
        </button>
      </div>

      <div className={styles.sessionSummaryNextDue}>{nextDueLabel}</div>
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
