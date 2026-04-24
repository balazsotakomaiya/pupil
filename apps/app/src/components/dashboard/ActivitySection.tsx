import styles from "./Dashboard.module.css";
import type { ActivityItem, StreakCellData } from "./types";

type ActivitySectionProps = {
  activity: ActivityItem[];
  streakCells: StreakCellData[];
  streakCount: number;
};

export function ActivitySection({ activity, streakCells, streakCount }: ActivitySectionProps) {
  return (
    <section className="section">
      <div className="section-head">
        <span className="section-label">Activity</span>
      </div>

      <div className={styles.bottomGrid}>
        <div className={styles.streakWrap}>
          <div className={styles.streakHeader}>
            <span className={styles.streakTitle}>Study calendar</span>
            <span className={styles.streakCount}>
              <strong>{streakCount} day</strong> streak
            </span>
          </div>

          <div className={styles.streakGrid}>
            {streakCells.map((cell) => (
              <div
                aria-hidden="true"
                className={`${styles.streakCell}${cell.studied ? ` ${styles.studied}` : ""}${cell.today ? ` ${styles.today}` : ""}`}
                key={cell.id}
              />
            ))}
          </div>

          <div className={styles.streakLegend}>
            <div className={styles.streakLegendItem}>
              <div className={`${styles.streakLegendSwatch} ${styles.streakLegendSwatchIdle}`} />
              No study
            </div>
            <div className={styles.streakLegendItem}>
              <div className={`${styles.streakLegendSwatch} ${styles.streakLegendSwatchStudied}`} />
              Studied
            </div>
            <div className={styles.streakLegendItem}>
              <div className={`${styles.streakLegendSwatch} ${styles.streakLegendSwatchToday}`} />
              Today
            </div>
          </div>
        </div>

        <div className={styles.activityWrap}>
          <div className={styles.activityHeaderBar}>
            <span className={styles.ahTitle}>Recent</span>
          </div>

          {activity.length === 0 ? (
            <div className={styles.activityEmpty}>
              No study activity yet. Your first reviews will show up here.
            </div>
          ) : (
            activity.map((item) => (
              <div className={styles.activityRow} key={item.id}>
                <span className={styles.activityTime}>{item.timeLabel}</span>
                <span className={styles.activityDesc}>
                  {item.prefix}
                  <strong>{item.highlight}</strong>
                  {item.suffix ?? ""}
                </span>
                <span className={styles.activityType}>{item.typeLabel}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
