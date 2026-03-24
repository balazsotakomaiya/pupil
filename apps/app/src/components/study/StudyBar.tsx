type StudyBarProps = {
  current: number;
  onEnd: () => void;
  scopeLabel: string;
  total: number;
};

export function StudyBar({ current, onEnd, scopeLabel, total }: StudyBarProps) {
  return (
    <div className="session-bar">
      <div className="session-bar-left">
        <button className="session-exit-btn" onClick={onEnd} type="button">
          <BackIcon />
          End
        </button>
        <span className="session-scope">{scopeLabel}</span>
      </div>

      <div className="session-bar-right">
        <span className="session-counter">
          <strong>{current}</strong> / <span>{total}</span>
        </span>
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 3L5 8l5 5" />
    </svg>
  );
}
