import styles from "./AiGenerate.module.css";
import { KeyIcon, PlusIcon } from "./AiGenerateIcons";

type AiGenerateNoKeyProps = {
  onOpenSettings: () => void;
};

export function AiGenerateNoKey({ onOpenSettings }: AiGenerateNoKeyProps) {
  return (
    <div className={styles.aiGenStateView}>
      <div className={styles.aiGenNoKeySection}>
        <div className={styles.aiGenNoKeyIcon}>
          <KeyIcon />
        </div>
        <div className={styles.aiGenNoKeyTitle}>API key required</div>
        <div className={styles.aiGenNoKeyDesc}>
          AI generation needs an API key from Anthropic, OpenAI, or any compatible provider. Your
          key is stored locally on this device.
        </div>
        <button className={styles.aiGenNoKeyBtn} onClick={onOpenSettings} type="button">
          <PlusIcon />
          Add API key in Settings
        </button>
        <div className={styles.aiGenNoKeyHint}>
          Supported: <code>api.anthropic.com</code> · <code>api.openai.com</code> · any
          OpenAI-compatible endpoint
        </div>
      </div>
    </div>
  );
}
