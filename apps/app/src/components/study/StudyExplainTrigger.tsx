import styles from "./Study.module.css";

type StudyExplainTriggerProps = {
  hasApiKey: boolean;
  isLoading: boolean;
  onActivate: () => void;
};

export function StudyExplainTrigger({
  hasApiKey,
  isLoading,
  onActivate,
}: StudyExplainTriggerProps) {
  const label = hasApiKey ? "Explain in detail" : "Set up AI to explain";

  return (
    <button
      className={`${styles.sessionExplainTrigger}${hasApiKey ? "" : ` ${styles.locked}`}`}
      disabled={isLoading}
      onClick={onActivate}
      type="button"
    >
      {hasApiKey ? <SparkIcon /> : <LockIcon />}
      <span>{isLoading ? "Thinking…" : label}</span>
    </button>
  );
}

function SparkIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 16 16">
      <path
        d="M8 1.5l1.4 3.6L13 6.5l-3.6 1.4L8 11.5 6.6 7.9 3 6.5l3.6-1.4z"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 11l.6 1.4L14.5 13l-1.4.6L12.5 15l-.6-1.4L10.5 13l1.4-.6z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 16 16">
      <rect x="3.5" y="7" width="9" height="6" rx="1.4" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" strokeLinecap="round" />
    </svg>
  );
}
