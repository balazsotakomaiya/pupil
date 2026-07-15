import { type KeyboardEvent, type MouseEvent, type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./Modal.module.css";

type ModalProps = {
  ariaDescribedBy?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  children: ReactNode;
  closeOnEscape?: boolean;
  isOpen: boolean;
  onBackdropClick?: () => void;
  onClose: () => void;
  overlayClassName?: string;
  panelClassName?: string;
  size?: "medium" | "small" | "wide";
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function Modal({
  ariaDescribedBy,
  ariaLabel,
  ariaLabelledBy,
  children,
  closeOnEscape = true,
  isOpen,
  onBackdropClick,
  onClose,
  overlayClassName,
  panelClassName,
  size = "small",
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      const autofocusElement =
        panelRef.current?.querySelector<HTMLElement>("[data-modal-autofocus]");
      const firstFocusableElement =
        panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (autofocusElement ?? firstFocusableElement ?? panelRef.current)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousBodyOverflow;

      if (previousActiveElementRef.current?.isConnected) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();

    if (event.key === "Escape" && closeOnEscape) {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);

    if (!focusableElements || focusableElements.length === 0) {
      event.preventDefault();
      panelRef.current?.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  function handleOverlayMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    onBackdropClick ? onBackdropClick() : onClose();
  }

  return createPortal(
    <div
      className={`${styles.modalOverlay}${overlayClassName ? ` ${overlayClassName}` : ""}`}
      onMouseDown={handleOverlayMouseDown}
      role="presentation"
    >
      <div
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-modal="true"
        className={`${styles.modalPanel} ${styles[`modalPanel${capitalize(size)}`]}${panelClassName ? ` ${panelClassName}` : ""}`}
        onKeyDown={handlePanelKeyDown}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
