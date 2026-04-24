import styles from "./AiGenerate.module.css";

type AiGenerateLoadingProps = {
  model: string;
  topic: string;
};

export function AiGenerateLoading({ model, topic }: AiGenerateLoadingProps) {
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
      </div>
    </div>
  );
}
