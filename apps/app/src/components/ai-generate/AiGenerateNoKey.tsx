import { KeyIcon, PlusIcon } from "../icons/AiGenerateIcons";
import styles from "./AiGenerate.module.css";

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
        <div className={styles.aiGenNoKeyTitle}>Connect AI to generate cards</div>
        <div className={styles.aiGenNoKeyDesc}>
          Use the ChatGPT or Claude plan you already pay for, or an API key from any compatible
          provider. Set it up once in Settings.
        </div>
        <button className={styles.aiGenNoKeyBtn} onClick={onOpenSettings} type="button">
          <PlusIcon />
          Set up AI in Settings
        </button>
        <div className={styles.aiGenNoKeyHint}>
          ChatGPT Plus or Pro · Claude Pro or Max with Claude Code · OpenAI, Anthropic, or any
          OpenAI-compatible endpoint
        </div>
      </div>
    </div>
  );
}
