import type { FormEvent } from "react";

export type DashboardTab = {
  label: string;
  active?: boolean;
};

export type StudyBreakdownItem = {
  label: string;
  value: number;
};

export type StudySummary = {
  eyebrow: string;
  headline: string;
  description: string;
  breakdown: StudyBreakdownItem[];
  primaryActionLabel: string;
  secondaryActionLabel: string;
};

export type StatCardData = {
  label: string;
  value: string;
  unit?: string;
  trend?: string;
  subtext: string;
};

export type SpaceCardMeta = {
  label: string;
  value: string;
  variant?: "default" | "due" | "aux";
};

export type SpaceCardData = {
  id: string;
  name: string;
  description: string;
  streakLabel?: string;
  meta: SpaceCardMeta[];
};

export type ActivityItem = {
  id: string;
  timeLabel: string;
  prefix: string;
  highlight: string;
  suffix?: string;
  typeLabel: string;
};

export type StreakCellData = {
  id: string;
  studied: boolean;
  today: boolean;
};

type DashboardProps = {
  activity: ActivityItem[];
  isCreateDialogOpen: boolean;
  isCreatingSpace: boolean;
  newSpaceError: string | null;
  newSpaceName: string;
  onCloseCreateDialog: () => void;
  onCreateNameChange: (value: string) => void;
  onOpenCreateDialog: () => void;
  onStudyPrimaryAction?: () => void;
  onSubmitCreateDialog: (event: FormEvent<HTMLFormElement>) => void;
  spaces: SpaceCardData[];
  stats: StatCardData[];
  streakCells: StreakCellData[];
  streakCount: number;
  studySummary: StudySummary;
  tabs: DashboardTab[];
};

export function Dashboard({
  activity,
  isCreateDialogOpen,
  isCreatingSpace,
  newSpaceError,
  newSpaceName,
  onCloseCreateDialog,
  onCreateNameChange,
  onOpenCreateDialog,
  onStudyPrimaryAction,
  onSubmitCreateDialog,
  spaces,
  stats,
  streakCells,
  streakCount,
  studySummary,
  tabs,
}: DashboardProps) {
  return (
    <>
      <RulersOverlay />
      <div className="dashboard-shell">
        <DashboardTitlebar onOpenCreateDialog={onOpenCreateDialog} tabs={tabs} />

        <div className="page">
          <StudySection onPrimaryAction={onStudyPrimaryAction} summary={studySummary} />
          <div className="ruler-divider" />

          <StatsSection stats={stats} />
          <div className="ruler-divider" />

          <SpacesSection onOpenCreateDialog={onOpenCreateDialog} spaces={spaces} />
          <div className="ruler-divider" />

          <ActivitySection activity={activity} streakCells={streakCells} streakCount={streakCount} />

          <div className="page-end" />
        </div>
      </div>

      {isCreateDialogOpen ? (
        <NewSpaceDialog
          error={newSpaceError}
          isSubmitting={isCreatingSpace}
          onChange={onCreateNameChange}
          onClose={onCloseCreateDialog}
          onSubmit={onSubmitCreateDialog}
          value={newSpaceName}
        />
      ) : null}
    </>
  );
}

function RulersOverlay() {
  return (
    <div aria-hidden="true" className="rulers">
      <div className="ruler-v left" />
      <div className="ruler-v right" />
      <div className="ruler-v content-left" />
      <div className="ruler-v content-right" />
      <div className="ruler-h top" />
      <div className="ruler-h bottom" />
    </div>
  );
}

function DashboardTitlebar({
  onOpenCreateDialog,
  tabs,
}: {
  onOpenCreateDialog: () => void;
  tabs: DashboardTab[];
}) {
  return (
    <div className="titlebar">
      <div className="titlebar-left">
        <div className="titlebar-logo">
          <EyeLogo />
          <span className="titlebar-logo-text">pupil</span>
        </div>

        <div className="titlebar-sep" />

        <div className="titlebar-tabs">
          {tabs.map((tab) => (
            <span
              aria-current={tab.active ? "page" : undefined}
              className={`titlebar-tab${tab.active ? " active" : ""}`}
              key={tab.label}
            >
              {tab.label}
            </span>
          ))}
        </div>
      </div>

      <div className="titlebar-right">
        <button className="titlebar-btn-label" onClick={onOpenCreateDialog} type="button">
          <PlusIcon />
          New Space
        </button>
        <button aria-label="Search" className="titlebar-btn" type="button">
          <SearchIcon />
        </button>
      </div>
    </div>
  );
}

function StudySection({
  onPrimaryAction,
  summary,
}: {
  onPrimaryAction?: () => void;
  summary: StudySummary;
}) {
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
          <button
            className="study-btn"
            onClick={onPrimaryAction}
            type="button"
          >
            {summary.primaryActionLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

function StatsSection({ stats }: { stats: StatCardData[] }) {
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

function SpacesSection({
  onOpenCreateDialog,
  spaces,
}: {
  onOpenCreateDialog: () => void;
  spaces: SpaceCardData[];
}) {
  return (
    <section className="section">
      <div className="section-head">
        <span className="section-label">Spaces</span>
        <button className="btn-ghost" onClick={onOpenCreateDialog} type="button">
          <PlusIcon />
          New Space
        </button>
      </div>

      <div className="spaces-grid">
        {spaces.map((space) => (
          <SpaceCard key={space.id} space={space} />
        ))}
      </div>
    </section>
  );
}

function SpaceCard({ space }: { space: SpaceCardData }) {
  return (
    <article className="space-card">
      <div className="space-top">
        <span className="space-name">{space.name}</span>
        {space.streakLabel ? (
          <span className="space-streak">
            <span className="streak-dot" />
            {space.streakLabel}
          </span>
        ) : (
          <span className="space-streak" />
        )}
      </div>
      <div className="space-desc">{space.description}</div>
      <div className="space-meta">
        {space.meta.map((item) => (
          <div className="space-meta-item" key={`${space.id}-${item.label}`}>
            {item.variant === "aux" ? (
              <span className="space-source">{item.value}</span>
            ) : item.variant === "due" ? (
              <span className="space-meta-val">
                <span className="due-indicator">
                  <span className="due-dot" />
                  {item.value}
                </span>
              </span>
            ) : (
              <span className="space-meta-val">{item.value}</span>
            )}
            <span className="space-meta-label">{item.label}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function ActivitySection({
  activity,
  streakCells,
  streakCount,
}: {
  activity: ActivityItem[];
  streakCells: StreakCellData[];
  streakCount: number;
}) {
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

function NewSpaceDialog({
  error,
  isSubmitting,
  onChange,
  onClose,
  onSubmit,
  value,
}: {
  error: string | null;
  isSubmitting: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  value: string;
}) {
  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <div
        aria-describedby={error ? "new-space-error" : "new-space-description"}
        aria-labelledby="new-space-title"
        aria-modal="true"
        className="dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <form className="dialog-form" onSubmit={onSubmit}>
          <div className="dialog-head">
            <div>
              <h2 id="new-space-title">New Space</h2>
              <p id="new-space-description">
                Start a topic, subject, or project space for your cards.
              </p>
            </div>
            <button
              aria-label="Close"
              className="dialog-close"
              onClick={onClose}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>

          <label className="field">
            <span className="field-label">Name</span>
            <input
              autoFocus
              className="field-input"
              onChange={(event) => onChange(event.target.value)}
              placeholder="Machine Learning"
              value={value}
            />
          </label>

          {error ? (
            <p className="field-error" id="new-space-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="dialog-actions">
            <button className="study-btn-secondary" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="study-btn" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creating..." : "Create Space"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EyeLogo() {
  return (
    <svg
      className="eye-logo"
      viewBox="0 0 52 52"
      width="24"
      height="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        className="eye-shape"
        d="M 2 26 C 12 10, 40 10, 50 26 C 40 42, 12 42, 2 26 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <circle className="eye-iris" cx="26" cy="26" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <g className="eye-pupil-g">
        <circle className="eye-pupil" cx="26" cy="26" r="3.5" fill="currentColor" />
      </g>
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 2v10M2 7h10" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  );
}
