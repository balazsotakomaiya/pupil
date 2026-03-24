import type { ActivityItem, StreakCellData } from "./types";

type ActivitySectionProps = {
  activity: ActivityItem[];
  streakCells: StreakCellData[];
  streakCount: number;
};

export function ActivitySection({
  activity,
  streakCells,
  streakCount,
}: ActivitySectionProps) {
  return (
    <section className="section">
      <div className="section-head">
        <span className="section-label">Activity</span>
      </div>

      <div className="bottom-grid">
        <div className="streak-wrap">
          <div className="streak-header">
            <span className="streak-title">Study calendar</span>
            <span className="streak-count">
              <strong>{streakCount} day</strong> streak
            </span>
          </div>

          <div className="streak-grid">
            {streakCells.map((cell) => (
              <div
                aria-hidden="true"
                className={`streak-cell${cell.studied ? " studied" : ""}${cell.today ? " today" : ""}`}
                key={cell.id}
              />
            ))}
          </div>

          <div className="streak-legend">
            <div className="streak-legend-item">
              <div className="streak-legend-swatch streak-legend-swatch-idle" />
              No study
            </div>
            <div className="streak-legend-item">
              <div className="streak-legend-swatch streak-legend-swatch-studied" />
              Studied
            </div>
            <div className="streak-legend-item">
              <div className="streak-legend-swatch streak-legend-swatch-today" />
              Today
            </div>
          </div>
        </div>

        <div className="activity-wrap">
          <div className="activity-header-bar">
            <span className="ah-title">Recent</span>
            <span className="ah-link">View all →</span>
          </div>

          {activity.map((item) => (
            <div className="activity-row" key={item.id}>
              <span className="activity-time">{item.timeLabel}</span>
              <span className="activity-desc">
                {item.prefix}
                <strong>{item.highlight}</strong>
                {item.suffix ?? ""}
              </span>
              <span className="activity-type">{item.typeLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
