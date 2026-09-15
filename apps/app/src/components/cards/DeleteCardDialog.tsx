import { Button } from "../Button";
import { CloseIcon } from "../icons/CloseIcon";
import { Modal } from "../modal";

type DeleteCardDialogProps = {
  cardFront: string;
  isDeleting?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteCardDialog({
  cardFront,
  isDeleting = false,
  isOpen,
  onClose,
  onConfirm,
}: DeleteCardDialogProps) {
  return (
    <Modal
      ariaDescribedBy="card-delete-confirm-description"
      ariaLabelledBy="card-delete-confirm-title"
      closeOnEscape={!isDeleting}
      isOpen={isOpen}
      onClose={onClose}
      onBackdropClick={() => {
        if (!isDeleting) {
          onClose();
        }
      }}
    >
      <div className="dialog-form">
        <div className="dialog-head">
          <div>
            <h2 id="card-delete-confirm-title">Delete card?</h2>
            <p id="card-delete-confirm-description">
              {cardFront ? (
                <>
                  Delete <strong>“{cardFront}”</strong>? This action cannot be undone.
                </>
              ) : (
                "This will permanently remove this card. This action cannot be undone."
              )}
            </p>
          </div>
          <Button
            aria-label="Close delete confirmation"
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
            {isDeleting ? "Deleting…" : "Delete card"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
