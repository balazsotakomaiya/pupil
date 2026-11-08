import type { AiConnectionKind } from "../../lib/ai-settings";
import styles from "./SettingsAiConnection.module.css";

const OPTIONS: Array<{ description: string; label: string; value: AiConnectionKind }> = [
  {
    description: "Use your Plus or Pro plan. Sign in with your ChatGPT account.",
    label: "ChatGPT plan",
    value: "chatgpt",
  },
  {
    description: "Use your Pro or Max plan through Claude Code on this computer.",
    label: "Claude plan",
    value: "claudeCode",
  },
  {
    description: "OpenAI, Anthropic, Gemini, OpenRouter, or a custom or local endpoint.",
    label: "API key",
    value: "apiKey",
  },
];

type Props = {
  disabled: boolean;
  onChange: (connection: AiConnectionKind) => void;
  value: AiConnectionKind;
};

export function SettingsAiConnectionPicker({ disabled, onChange, value }: Props) {
  return (
    <div className={styles.connectionOptions} role="group" aria-label="AI connection">
      {OPTIONS.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            aria-pressed={isSelected}
            className={`${styles.connectionOption}${isSelected ? ` ${styles.selected}` : ""}`}
            disabled={disabled}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            <span className={styles.connectionOptionLabel}>{option.label}</span>
            <span className={styles.connectionOptionDescription}>{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}
