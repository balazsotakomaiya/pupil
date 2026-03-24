import { KeyIcon, PlusIcon } from "./AiGenerateIcons";

type AiGenerateNoKeyProps = {
  onOpenSettings: () => void;
};

export function AiGenerateNoKey({ onOpenSettings }: AiGenerateNoKeyProps) {
  return (
    <div className="ai-gen-state-view active">
      <div className="ai-gen-no-key-section">
        <div className="ai-gen-no-key-icon">
          <KeyIcon />
        </div>
        <div className="ai-gen-no-key-title">API key required</div>
        <div className="ai-gen-no-key-desc">
          AI generation needs an API key from Anthropic, OpenAI, or any compatible provider. Your
          key is stored locally on this device.
        </div>
        <button className="ai-gen-no-key-btn" onClick={onOpenSettings} type="button">
          <PlusIcon />
          Add API key in Settings
        </button>
        <div className="ai-gen-no-key-hint">
          Supported: <code>api.anthropic.com</code> · <code>api.openai.com</code> · any
          OpenAI-compatible endpoint
        </div>
      </div>
    </div>
  );
}
