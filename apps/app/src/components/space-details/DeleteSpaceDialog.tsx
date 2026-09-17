import { Button } from "../Button";
import { CloseIcon } from "../icons/CloseIcon";
import { Modal } from "../modal";

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
    <Modal
      ariaDescribedBy="delete-space-description"
      ariaLabelledBy="delete-space-title"
      closeOnEscape={!isDeleting}
      isOpen
      onBackdropClick={onClose}
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
          <Button
            aria-label="Close"
            disabled={isDeleting}
            onClick={onClose}
            size="icon"
            variant="outline"
          >
            <CloseIcon />
          </Button>
        </div>

        <div className="dialog-actions">
          <Button disabled={isDeleting} onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button disabled={isDeleting} onClick={onConfirm} variant="destructive">
            {isDeleting ? "Deleting…" : "Delete space"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
