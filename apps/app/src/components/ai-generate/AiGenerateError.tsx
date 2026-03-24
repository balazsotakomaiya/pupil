import { AlertIcon } from "./AiGenerateIcons";

type AiGenerateErrorProps = {
  detail: string;
  onEditPrompt: () => void;
  onRetry: () => void;
};

export function AiGenerateError({ detail, onEditPrompt, onRetry }: AiGenerateErrorProps) {
  return (
    <div className="ai-gen-state-view active">
      <div className="ai-gen-error-section">
        <div className="ai-gen-error-icon">
          <AlertIcon />
        </div>
        <div className="ai-gen-error-title">Generation failed</div>
        <div className="ai-gen-error-desc">
          The AI run did not complete. Check the prompt or provider settings and try again.
        </div>
        <div className="ai-gen-error-detail">{detail}</div>
        <div className="ai-gen-error-actions">
          <button className="ai-gen-error-btn" onClick={onEditPrompt} type="button">
            Edit prompt
          </button>
          <button className="ai-gen-error-btn primary" onClick={onRetry} type="button">
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}
