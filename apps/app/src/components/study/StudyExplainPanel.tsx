import { useEffect } from "react";
import styles from "./Study.module.css";

type StudyExplainPanelProps = {
  cardFront: string;
  error: string | null;
  explanation: string | null;
  generatedAt: number | null;
  isCached: boolean;
  isLoading: boolean;
  onClose: () => void;
  onRegenerate: () => void;
  onRetry: () => void;
};

export function StudyExplainPanel({
  cardFront,
  error,
  explanation,
  generatedAt,
  isCached,
  isLoading,
  onClose,
  onRegenerate,
  onRetry,
}: StudyExplainPanelProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [onClose]);

  const promptPreview = cardFront.length > 60 ? `${cardFront.slice(0, 60)}…` : cardFront;

  return (
    <>
      <div className={styles.sessionExplainBackdrop} onClick={onClose} role="presentation" />
      <aside aria-label="AI explanation" className={styles.sessionExplainPanel}>
        <header className={styles.sessionExplainHeader}>
          <div className={styles.sessionExplainHeaderLeft}>
            <h2 className={styles.sessionExplainTitle}>Explanation</h2>
            <span className={styles.sessionExplainSub}>{promptPreview}</span>
          </div>
          <div className={styles.sessionExplainHeaderActions}>
            {explanation && !isLoading && !error ? (
              <button
                className={styles.sessionExplainHeaderBtn}
                disabled={isLoading}
                onClick={onRegenerate}
                type="button"
              >
                Regenerate
              </button>
            ) : null}
            <button
              aria-label="Close explanation panel"
              className={styles.sessionExplainCloseBtn}
              onClick={onClose}
              type="button"
            >
              ✕
            </button>
          </div>
        </header>

        <div className={styles.sessionExplainBody}>
          {isLoading ? (
            <div className={styles.sessionExplainLoading}>
              <div className={styles.sessionExplainSkeleton} />
              <div className={styles.sessionExplainSkeleton} />
              <div className={styles.sessionExplainSkeleton} />
              <div className={styles.sessionExplainSkeleton} />
              <span className={styles.sessionExplainLoadingNote}>Asking your model…</span>
            </div>
          ) : error ? (
            <div className={styles.sessionExplainError}>
              <span>{error}</span>
              <button className={styles.sessionExplainRetryBtn} onClick={onRetry} type="button">
                Try again
              </button>
            </div>
          ) : explanation ? (
            <div className={styles.sessionExplainText}>
              {explanation
                .split(/\n\s*\n/)
                .map((paragraph) => paragraph.trim())
                .filter((paragraph) => paragraph.length > 0)
                .map((paragraph, index) => (
                  <p key={`para-${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>
                ))}
            </div>
          ) : null}
        </div>

        <footer className={styles.sessionExplainFooter}>
          <span>{isCached ? "From cache" : explanation ? "Just generated" : ""}</span>
          <span>{generatedAt ? formatRelativeTime(generatedAt) : ""}</span>
        </footer>
      </aside>
    </>
  );
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMinutes < 1) {
    return "Just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
