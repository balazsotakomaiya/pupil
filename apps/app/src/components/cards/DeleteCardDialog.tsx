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
          <button
            aria-label="Close delete confirmation"
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
            {isDeleting ? "Deleting…" : "Delete card"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
