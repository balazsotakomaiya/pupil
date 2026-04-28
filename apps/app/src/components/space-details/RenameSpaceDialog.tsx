import type { FormEvent } from "react";
import { useState } from "react";
import { SPACE_NAME_MAX_LENGTH } from "../../lib/spaces";
import { CloseIcon } from "../dashboard/CloseIcon";

type RenameSpaceDialogProps = {
  error: string | null;
  isSubmitting: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  originalName: string;
  value: string;
};

export function RenameSpaceDialog({
  error,
  isSubmitting,
  onChange,
  onClose,
  onSubmit,
  originalName,
  value,
}: RenameSpaceDialogProps) {
  const [shakeKey, setShakeKey] = useState(0);

  function handleBackdropClick() {
    if (value.trim() === originalName) {
      onClose();
      return;
    }

    setShakeKey((currentKey) => currentKey + 1);
  }

  return (
    <div className="dialog-backdrop" onClick={handleBackdropClick} role="presentation">
      <div
        aria-describedby={error ? "rename-space-error" : "rename-space-description"}
        aria-labelledby="rename-space-title"
        aria-modal="true"
        className="dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <form className="dialog-form" onSubmit={onSubmit}>
          <div className="dialog-head">
            <div>
              <h2 id="rename-space-title">Rename space</h2>
              <p id="rename-space-description">Give this study space a clearer name.</p>
            </div>
            <button
              aria-label="Close"
              className="dialog-close"
              disabled={isSubmitting}
              onClick={onClose}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>

          <label className="field">
            <span className="field-label">Name</span>
            <input
              autoFocus
              className="field-input"
              maxLength={SPACE_NAME_MAX_LENGTH}
              onChange={(event) => onChange(event.target.value)}
              placeholder="Machine Learning"
              value={value}
            />
            {error ? (
              <p className="field-error" id="rename-space-error" role="alert">
                {error}
              </p>
            ) : null}
          </label>

          <div className={`dialog-actions${shakeKey > 0 ? " shake" : ""}`} key={shakeKey}>
            <button
              className="study-btn-secondary"
              disabled={isSubmitting}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button className="study-btn" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Renaming..." : "Rename space"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
