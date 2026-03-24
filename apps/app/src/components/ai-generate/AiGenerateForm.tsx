import type { SpaceSummary } from "../../lib/spaces";
import {
  ChevronDownIcon,
  InfoIcon,
  MinusIcon,
  MoreIcon,
  PlusIcon,
  SparklesIcon,
} from "./AiGenerateIcons";
import type { AiDifficulty, AiGenerateDraft, AiStyle } from "./types";

const DIFFICULTIES: AiDifficulty[] = ["Beginner", "Intermediate", "Advanced"];
const STYLES: AiStyle[] = ["Concept", "Q&A", "Cloze"];
export const NEW_SPACE_OPTION_ID = "__new_space__";

type AiGenerateFormProps = {
  draft: AiGenerateDraft;
  endpointHost: string;
  error: string | null;
  model: string;
  onChange: (patch: Partial<AiGenerateDraft>) => void;
  onGenerate: () => void;
  onOpenSettings: () => void;
  onOpenStyleModal: () => void;
  spaces: SpaceSummary[];
};

export function AiGenerateForm({
  draft,
  endpointHost,
  error,
  model,
  onChange,
  onGenerate,
  onOpenSettings,
  onOpenStyleModal,
  spaces,
}: AiGenerateFormProps) {
  const selectedExistingSpace =
    draft.spaceId !== NEW_SPACE_OPTION_ID
      ? spaces.find((space) => space.id === draft.spaceId) ?? null
      : null;

  return (
    <div className="ai-gen-state-view active">
      <div className="ai-gen-form-section">
        <div className="ai-gen-form-title">Generate flashcards</div>
        <div className="ai-gen-form-desc">
          Describe what you want to learn. Pupil generates cards you review and approve before
          saving.
        </div>

        <div className="ai-gen-field-group">
          <div className="ai-gen-field">
            <label className="ai-gen-field-label" htmlFor="ai-gen-topic">
              Topic
            </label>
            <textarea
              className="ai-gen-topic-input"
              id="ai-gen-topic"
              onChange={(event) => onChange({ topic: event.target.value })}
              placeholder="e.g. The transformer architecture — self-attention, multi-head attention, positional encoding, layer normalization…"
              value={draft.topic}
            />
            <div className="ai-gen-field-hint">
              Be specific. The more context you give, the better the cards.
            </div>
          </div>

          <div className="ai-gen-field">
            <label className="ai-gen-field-label" htmlFor="ai-gen-space">
              Space
            </label>
            <div className="ai-gen-select-wrap">
              <select
                className="ai-gen-select-input"
                id="ai-gen-space"
                onChange={(event) => onChange({ spaceId: event.target.value })}
                value={draft.spaceId}
              >
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
                <option value={NEW_SPACE_OPTION_ID}>+ Create new space</option>
              </select>
              <div className="ai-gen-select-chevron">
                <ChevronDownIcon />
              </div>
            </div>
            {draft.spaceId === NEW_SPACE_OPTION_ID ? (
              <input
                className="ai-gen-new-space-input"
                onChange={(event) => onChange({ newSpaceName: event.target.value })}
                placeholder="Name the new space"
                type="text"
                value={draft.newSpaceName}
              />
            ) : selectedExistingSpace ? (
              <div className="ai-gen-field-hint">
                Saving generated cards into {selectedExistingSpace.name}.
              </div>
            ) : null}
          </div>

          <div className="ai-gen-config-row">
            <div className="ai-gen-field">
              <label className="ai-gen-field-label">Difficulty</label>
              <div className="ai-gen-chip-group">
                {DIFFICULTIES.map((difficulty) => (
                  <button
                    className={`ai-gen-chip${draft.difficulty === difficulty ? " active" : ""}`}
                    key={difficulty}
                    onClick={() => onChange({ difficulty })}
                    type="button"
                  >
                    {difficulty}
                  </button>
                ))}
              </div>
            </div>

            <div className="ai-gen-field">
              <label className="ai-gen-field-label">
                Style
                <button
                  aria-label="Explain card styles"
                  className="ai-gen-info-btn"
                  onClick={onOpenStyleModal}
                  type="button"
                >
                  <InfoIcon />
                </button>
              </label>
              <div className="ai-gen-chip-group">
                {STYLES.map((style) => (
                  <button
                    className={`ai-gen-chip${draft.style === style ? " active" : ""}`}
                    key={style}
                    onClick={() => onChange({ style })}
                    type="button"
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <div className="ai-gen-field">
              <label className="ai-gen-field-label">Count</label>
              <div className="ai-gen-count-row">
                <div className={`ai-gen-count-stepper${draft.autoCount ? " disabled" : ""}`}>
                  <button
                    className="ai-gen-count-btn"
                    onClick={() => onChange({ count: Math.max(1, draft.count - 1) })}
                    type="button"
                  >
                    <MinusIcon />
                  </button>
                  <div className="ai-gen-count-value">{draft.count}</div>
                  <button
                    className="ai-gen-count-btn"
                    onClick={() => onChange({ count: Math.min(30, draft.count + 1) })}
                    type="button"
                  >
                    <PlusIcon />
                  </button>
                </div>
                <button
                  className={`ai-gen-auto-toggle${draft.autoCount ? " active" : ""}`}
                  onClick={() => onChange({ autoCount: !draft.autoCount })}
                  type="button"
                >
                  <span className="ai-gen-auto-toggle-label">Auto</span>
                  <div className="ai-gen-toggle-track">
                    <div className="ai-gen-toggle-thumb" />
                  </div>
                </button>
              </div>
              <div className="ai-gen-field-hint">
                {draft.autoCount
                  ? "The AI will decide how many cards this topic needs."
                  : "Or let the AI decide how many cards the topic needs."}
              </div>
            </div>
          </div>

          <div className="ai-gen-form-bottom">
            <div className="ai-gen-form-bottom-left">
              <button className="ai-gen-generate-btn" onClick={onGenerate} type="button">
                <SparklesIcon />
                {draft.autoCount ? "Generate cards" : `Generate ${draft.count} cards`}
              </button>
              {error ? <div className="ai-gen-inline-error">{error}</div> : null}
            </div>
            <div className="ai-gen-model-indicator">
              <button className="ai-gen-model-link" onClick={onOpenSettings} type="button">
                <span className="ai-gen-model-dot" />
                {model}
              </button>
              <span className="ai-gen-model-sep">·</span>
              <span className="ai-gen-model-endpoint">{endpointHost}</span>
              <button
                aria-label="Change model in settings"
                className="ai-gen-model-change-btn"
                onClick={onOpenSettings}
                type="button"
              >
                <MoreIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
