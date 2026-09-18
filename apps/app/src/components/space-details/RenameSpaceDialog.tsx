import { SPACE_NAME_MAX_LENGTH } from "@pupil/core";
import type { SyntheticEvent } from "react";
import { useState } from "react";
import { Button } from "../Button";
import { CloseIcon } from "../icons/CloseIcon";
import { Modal } from "../modal";

type RenameSpaceDialogProps = {
  error: string | null;
  isSubmitting: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
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
    <Modal
      ariaDescribedBy={error ? "rename-space-error" : "rename-space-description"}
      ariaLabelledBy="rename-space-title"
      closeOnEscape={!isSubmitting}
      isOpen
      onBackdropClick={handleBackdropClick}
      onClose={onClose}
    >
      <form className="dialog-form" onSubmit={onSubmit}>
        <div className="dialog-head">
          <div>
            <h2 id="rename-space-title">Rename space</h2>
            <p id="rename-space-description">Give this study space a clearer name.</p>
          </div>
          <Button
            aria-label="Close"
            disabled={isSubmitting}
            onClick={onClose}
            size="icon"
            variant="outline"
          >
            <CloseIcon />
          </Button>
        </div>

        <label className="field">
          <span className="field-label">Name</span>
          <input
            autoFocus
            data-modal-autofocus
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
          <Button disabled={isSubmitting} onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Renaming..." : "Rename space"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
