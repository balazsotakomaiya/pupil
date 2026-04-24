import styles from "./AiGenerate.module.css";
import { AlertIcon } from "./AiGenerateIcons";

type AiGenerateErrorProps = {
  detail: string;
  onEditPrompt: () => void;
  onRetry: () => void;
};

export function AiGenerateError({ detail, onEditPrompt, onRetry }: AiGenerateErrorProps) {
  return (
    <div className={styles.aiGenStateView}>
      <div className={styles.aiGenErrorSection}>
        <div className={styles.aiGenErrorIcon}>
          <AlertIcon />
        </div>
        <div className={styles.aiGenErrorTitle}>Generation failed</div>
        <div className={styles.aiGenErrorDesc}>
          The AI run did not complete. Check the prompt or provider settings and try again.
        </div>
        <div className={styles.aiGenErrorDetail}>{detail}</div>
        <div className={styles.aiGenErrorActions}>
          <button className={styles.aiGenErrorBtn} onClick={onEditPrompt} type="button">
            Edit prompt
          </button>
          <button
            className={`${styles.aiGenErrorBtn} ${styles.primary}`}
            onClick={onRetry}
            type="button"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}
