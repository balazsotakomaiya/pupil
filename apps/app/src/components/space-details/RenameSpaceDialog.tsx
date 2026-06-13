import type { FormEvent } from "react";
import { useState } from "react";
import { SPACE_NAME_MAX_LENGTH } from "../../lib/spaces";
import { CloseIcon } from "../icons/CloseIcon";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";

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
    <Dialog
      aria-describedby={error ? "rename-space-error" : "rename-space-description"}
      aria-labelledby="rename-space-title"
      onBackdropClick={handleBackdropClick}
      onClose={onClose}
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
          <Button disabled={isSubmitting} onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Renaming..." : "Rename space"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
