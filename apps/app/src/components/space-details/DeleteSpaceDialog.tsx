import { CloseIcon } from "../icons/CloseIcon";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";

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
    <Dialog
      aria-describedby="delete-space-description"
      aria-labelledby="delete-space-title"
      onClose={onClose}
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
          <Button disabled={isDeleting} onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
          <Button disabled={isDeleting} onClick={onConfirm} type="button" variant="danger">
            {isDeleting ? "Deleting…" : "Delete space"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
