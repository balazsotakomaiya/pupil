import type { SpaceSummary } from "../../lib/spaces";
import styles from "./AiGenerate.module.css";
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
      ? (spaces.find((space) => space.id === draft.spaceId) ?? null)
      : null;

  return (
    <div className={styles.aiGenStateView}>
      <div className={styles.aiGenFormSection}>
        <div className={styles.aiGenFormTitle}>Generate flashcards</div>
        <div className={styles.aiGenFormDesc}>
          Describe what you want to learn. Pupil generates cards you review and approve before
          saving.
        </div>

        <div className={styles.aiGenFieldGroup}>
          <div className={styles.aiGenField}>
            <label className={styles.aiGenFieldLabel} htmlFor="ai-gen-topic">
              Topic
            </label>
            <textarea
              className={styles.aiGenTopicInput}
              id="ai-gen-topic"
              onChange={(event) => onChange({ topic: event.target.value })}
              placeholder="e.g. The transformer architecture — self-attention, multi-head attention, positional encoding, layer normalization…"
              value={draft.topic}
            />
            <div className={styles.aiGenFieldHint}>
              Be specific. The more context you give, the better the cards.
            </div>
          </div>

          <div className={styles.aiGenField}>
            <label className={styles.aiGenFieldLabel} htmlFor="ai-gen-space">
              Space
            </label>
            <div className={styles.aiGenSelectWrap}>
              <select
                className={styles.aiGenSelectInput}
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
              <div className={styles.aiGenSelectChevron}>
                <ChevronDownIcon />
              </div>
            </div>
            {draft.spaceId === NEW_SPACE_OPTION_ID ? (
              <input
                className={styles.aiGenNewSpaceInput}
                onChange={(event) => onChange({ newSpaceName: event.target.value })}
                placeholder="Name the new space"
                type="text"
                value={draft.newSpaceName}
              />
            ) : selectedExistingSpace ? (
              <div className={styles.aiGenFieldHint}>
                Saving generated cards into {selectedExistingSpace.name}.
              </div>
            ) : null}
          </div>

          <div className={styles.aiGenConfigRow}>
            <div className={styles.aiGenField}>
              <label className={styles.aiGenFieldLabel}>Difficulty</label>
              <div className={styles.aiGenChipGroup}>
                {DIFFICULTIES.map((difficulty) => (
                  <button
                    className={`${styles.aiGenChip}${draft.difficulty === difficulty ? ` ${styles.active}` : ""}`}
                    key={difficulty}
                    onClick={() => onChange({ difficulty })}
                    type="button"
                  >
                    {difficulty}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.aiGenField}>
              <label className={styles.aiGenFieldLabel}>
                Style
                <button
                  aria-label="Explain card styles"
                  className={styles.aiGenInfoBtn}
                  onClick={onOpenStyleModal}
                  type="button"
                >
                  <InfoIcon />
                </button>
              </label>
              <div className={styles.aiGenChipGroup}>
                {STYLES.map((style) => (
                  <button
                    className={`${styles.aiGenChip}${draft.style === style ? ` ${styles.active}` : ""}`}
                    key={style}
                    onClick={() => onChange({ style })}
                    type="button"
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.aiGenField}>
              <label className={styles.aiGenFieldLabel}>Count</label>
              <div className={styles.aiGenCountRow}>
                <div
                  className={`${styles.aiGenCountStepper}${draft.autoCount ? ` ${styles.disabled}` : ""}`}
                >
                  <button
                    className={styles.aiGenCountBtn}
                    onClick={() => onChange({ count: Math.max(1, draft.count - 1) })}
                    type="button"
                  >
                    <MinusIcon />
                  </button>
                  <div className={styles.aiGenCountValue}>{draft.count}</div>
                  <button
                    className={styles.aiGenCountBtn}
                    onClick={() => onChange({ count: Math.min(30, draft.count + 1) })}
                    type="button"
                  >
                    <PlusIcon />
                  </button>
                </div>
                <button
                  className={`${styles.aiGenAutoToggle}${draft.autoCount ? ` ${styles.active}` : ""}`}
                  onClick={() => onChange({ autoCount: !draft.autoCount })}
                  type="button"
                >
                  <span className={styles.aiGenAutoToggleLabel}>Auto</span>
                  <div className={styles.aiGenToggleTrack}>
                    <div className={styles.aiGenToggleThumb} />
                  </div>
                </button>
              </div>
              <div className={styles.aiGenFieldHint}>
                {draft.autoCount
                  ? "The AI will decide how many cards this topic needs."
                  : "Or let the AI decide how many cards the topic needs."}
              </div>
            </div>
          </div>

          <div className={styles.aiGenFormBottom}>
            <div className={styles.aiGenFormBottomLeft}>
              <button className={styles.aiGenGenerateBtn} onClick={onGenerate} type="button">
                <SparklesIcon />
                {draft.autoCount ? "Generate cards" : `Generate ${draft.count} cards`}
              </button>
              {error ? <div className={styles.aiGenInlineError}>{error}</div> : null}
            </div>
            <div className={styles.aiGenModelIndicator}>
              <button className={styles.aiGenModelLink} onClick={onOpenSettings} type="button">
                <span className={styles.aiGenModelDot} />
                {model}
              </button>
              <span className={styles.aiGenModelSep}>·</span>
              <span className="ai-gen-model-endpoint">{endpointHost}</span>
              <button
                aria-label="Change model in settings"
                className={styles.aiGenModelChangeBtn}
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
