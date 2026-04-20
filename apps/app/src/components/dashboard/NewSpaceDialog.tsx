import type { FormEvent } from "react";
import { useState } from "react";
import { CloseIcon } from "./CloseIcon";

type NewSpaceDialogProps = {
  error: string | null;
  isSubmitting: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  value: string;
};

export function NewSpaceDialog({
  error,
  isSubmitting,
  onChange,
  onClose,
  onSubmit,
  value,
}: NewSpaceDialogProps) {
  const [shakeKey, setShakeKey] = useState(0);

  function handleBackdropClick() {
    if (!value.trim()) {
      onClose();
      return;
    }
    setShakeKey((k) => k + 1);
  }

  return (
    <div className="dialog-backdrop" onClick={handleBackdropClick} role="presentation">
      <div
        aria-describedby={error ? "new-space-error" : "new-space-description"}
        aria-labelledby="new-space-title"
        aria-modal="true"
        className="dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <form className="dialog-form" onSubmit={onSubmit}>
          <div className="dialog-head">
            <div>
              <h2 id="new-space-title">New Space</h2>
              <p id="new-space-description">
                Start a topic, subject, or project space for your cards.
              </p>
            </div>
            <button aria-label="Close" className="dialog-close" onClick={onClose} type="button">
              <CloseIcon />
            </button>
          </div>

          <label className="field">
            <span className="field-label">Name</span>
            <input
              autoFocus
              className="field-input"
              onChange={(event) => onChange(event.target.value)}
              placeholder="Machine Learning"
              value={value}
            />
          </label>

          {error ? (
            <p className="field-error" id="new-space-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className={`dialog-actions${shakeKey > 0 ? " shake" : ""}`} key={shakeKey}>
            <button className="study-btn-secondary" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="study-btn" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creating..." : "Create Space"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
