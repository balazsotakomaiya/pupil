import styles from "./AiGenerate.module.css";

type AiGenerateLoadingProps = {
  model: string;
  /** Stops the request; omitted while settings are still loading. */
  onCancel?: () => void;
  topic: string;
};

export function AiGenerateLoading({ model, onCancel, topic }: AiGenerateLoadingProps) {
  return (
    <div className={styles.aiGenStateView}>
      <div className={styles.aiGenLoadingSection}>
        <div className={styles.aiGenLoadingSpinner} />
        <div className={styles.aiGenLoadingTitle}>Generating cards…</div>
        <div className={styles.aiGenLoadingDesc}>
          Asking the model about {topic.trim() || "your topic"}.
        </div>
        <div className={styles.aiGenLoadingModel}>
          <span className={styles.aiGenModelDot} />
          {model}
        </div>
        {onCancel ? (
          <button className={styles.aiGenLoadingCancel} onClick={onCancel} type="button">
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
