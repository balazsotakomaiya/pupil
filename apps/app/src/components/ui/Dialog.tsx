import type { ReactNode } from "react";
import { useEffect } from "react";

interface DialogProps {
  "aria-describedby"?: string;
  "aria-labelledby": string;
  children: ReactNode;
  onBackdropClick?: () => void;
  onClose: () => void;
}

export function Dialog({
  "aria-describedby": ariaDescribedBy,
  "aria-labelledby": ariaLabelledBy,
  children,
  onBackdropClick,
  onClose,
}: DialogProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onClick={onBackdropClick ?? onClose} role="presentation">
      <div
        aria-describedby={ariaDescribedBy}
        aria-labelledby={ariaLabelledBy}
        aria-modal="true"
        className="dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        {children}
      </div>
    </div>
  );
}
