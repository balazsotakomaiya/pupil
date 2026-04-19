import { CloseIcon } from "../dashboard/CloseIcon";

type DeleteSpaceDialogProps = {
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
  spaceName: string;
};

export function DeleteSpaceDialog({
  isDeleting,
  onClose,
  onConfirm,
  spaceName,
}: DeleteSpaceDialogProps) {
  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <div
        aria-describedby="delete-space-description"
        aria-labelledby="delete-space-title"
        aria-modal="true"
        className="dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="dialog-form">
          <div className="dialog-head">
            <div>
              <h2 id="delete-space-title">Delete space</h2>
              <p id="delete-space-description">
                Permanently delete <strong>{spaceName}</strong> and all its cards? This cannot be
                undone.
              </p>
            </div>
            <button
              aria-label="Close"
              className="dialog-close"
              disabled={isDeleting}
              onClick={onClose}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="dialog-actions">
            <button
              className="study-btn-secondary"
              disabled={isDeleting}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="study-btn danger-btn"
              disabled={isDeleting}
              onClick={onConfirm}
              type="button"
            >
              {isDeleting ? "Deleting…" : "Delete space"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
