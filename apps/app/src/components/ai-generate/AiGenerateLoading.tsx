type AiGenerateLoadingProps = {
  model: string;
  topic: string;
};

export function AiGenerateLoading({ model, topic }: AiGenerateLoadingProps) {
  return (
    <div className="ai-gen-state-view active">
      <div className="ai-gen-loading-section">
        <div className="ai-gen-loading-spinner" />
        <div className="ai-gen-loading-title">Generating cards…</div>
        <div className="ai-gen-loading-desc">
          Asking the model about {topic.trim() || "your topic"}.
        </div>
        <div className="ai-gen-loading-model">
          <span className="ai-gen-model-dot" />
          {model}
        </div>
      </div>
    </div>
  );
}
