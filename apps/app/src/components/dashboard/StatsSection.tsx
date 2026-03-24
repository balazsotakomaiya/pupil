import type { StatCardData } from "./types";

type StatsSectionProps = {
  stats: StatCardData[];
};

export function StatsSection({ stats }: StatsSectionProps) {
  return (
    <section className="stats-section">
      <div className="stats-grid">
        {stats.map((stat) => (
          <div className="stat-card" key={stat.label}>
            <div className="stat-eyebrow">{stat.label}</div>
            <div className="stat-value">
              {stat.value}
              {stat.unit ? <span className="unit">{stat.unit}</span> : null}
            </div>
            <div className="stat-sub">
              {stat.trend ? <span className="up">{stat.trend}</span> : null}
              {stat.trend ? " " : ""}
              {stat.subtext}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
