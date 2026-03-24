import { CloseIcon } from "../dashboard/CloseIcon";
import type { SpaceSummary } from "../../lib/spaces";

type CardDraft = {
  back: string;
  front: string;
  spaceId: string;
  tagsText: string;
};

type CardFormPanelProps = {
  draft: CardDraft;
  error: string | null;
  hasSelectedCard: boolean;
  isDeleting: boolean;
  isOpen: boolean;
  isSubmitting: boolean;
  onChange: (patch: Partial<CardDraft>) => void;
  onClose: () => void;
  onDelete: () => void;
  onSubmit: () => void;
  spaces: SpaceSummary[];
};

export function CardFormPanel({
  draft,
  error,
  hasSelectedCard,
  isDeleting,
  isOpen,
  isSubmitting,
  onChange,
  onClose,
  onDelete,
  onSubmit,
  spaces,
}: CardFormPanelProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <div
        aria-describedby={error ? "card-form-error" : "card-form-description"}
        aria-labelledby="card-form-title"
        aria-modal="true"
        className="dialog card-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="dialog-form">
          <div className="dialog-head">
            <div>
              <h2 id="card-form-title">{hasSelectedCard ? "Edit Card" : "New Card"}</h2>
              <p id="card-form-description">
                Write a focused front/back pair. Tags are optional and comma-separated.
              </p>
            </div>
            <button aria-label="Close" className="dialog-close" onClick={onClose} type="button">
              <CloseIcon />
            </button>
          </div>

          <div className="field">
            <span className="field-label">Space</span>
            <select
              className="field-input field-select"
              onChange={(event) => onChange({ spaceId: event.target.value })}
              value={draft.spaceId}
            >
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          </div>

          <label className="field">
            <span className="field-label">Front</span>
            <textarea
              className="field-input field-textarea"
              onChange={(event) => onChange({ front: event.target.value })}
              placeholder="What is ownership in Rust?"
              rows={5}
              value={draft.front}
            />
          </label>

          <label className="field">
            <span className="field-label">Back</span>
            <textarea
              className="field-input field-textarea"
              onChange={(event) => onChange({ back: event.target.value })}
              placeholder="Ownership is Rust's model for managing memory through a single owner for each value."
              rows={8}
              value={draft.back}
            />
          </label>

          <label className="field">
            <span className="field-label">Tags</span>
            <input
              className="field-input"
              onChange={(event) => onChange({ tagsText: event.target.value })}
              placeholder="rust, memory, ownership"
              value={draft.tagsText}
            />
          </label>

          {error ? (
            <p className="field-error" id="card-form-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="dialog-actions">
            {hasSelectedCard ? (
              <button
                className="study-btn-secondary danger-btn"
                disabled={isDeleting || isSubmitting}
                onClick={onDelete}
                type="button"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            ) : null}
            <button className="study-btn-secondary" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className="study-btn"
              disabled={isSubmitting || isDeleting}
              onClick={onSubmit}
              type="button"
            >
              {isSubmitting
                ? hasSelectedCard
                  ? "Saving..."
                  : "Creating..."
                : hasSelectedCard
                  ? "Save Changes"
                  : "Create Card"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
