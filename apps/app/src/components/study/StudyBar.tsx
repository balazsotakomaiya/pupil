import { useEffect, useRef, useState } from "react";
import type { StudyCardRecord } from "./types";

type StudyBarProps = {
  current: number;
  currentCard: StudyCardRecord | null;
  isSuspended: boolean;
  onDeleteCard: () => void;
  onEnd: () => void;
  onSuspendCard: () => void;
  scopeLabel: string;
  total: number;
};

export function StudyBar({
  current,
  currentCard,
  isSuspended,
  onDeleteCard,
  onEnd,
  onSuspendCard,
  scopeLabel,
  total,
}: StudyBarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handleOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  function handleSuspend() {
    setIsMenuOpen(false);
    onSuspendCard();
  }

  function handleDelete() {
    setIsMenuOpen(false);
    onDeleteCard();
  }

  return (
    <div className="session-bar">
      <div className="session-bar-left">
        <button className="session-exit-btn" onClick={onEnd} type="button">
          <BackIcon />
          End
        </button>
        <span className="session-scope">{scopeLabel}</span>
      </div>

      <div className="session-bar-right">
        <span className="session-counter">
          <strong>{current}</strong> / <span>{total}</span>
        </span>

        {currentCard && !isSuspended ? (
          <div className="session-quick-actions" ref={menuRef}>
            <button
              aria-label="Card actions"
              className={`session-overflow-btn${isMenuOpen ? " active" : ""}`}
              onClick={() => setIsMenuOpen((open) => !open)}
              type="button"
            >
              <OverflowIcon />
            </button>

            {isMenuOpen ? (
              <div className="session-overflow-menu" role="menu">
                <button
                  className="session-overflow-item"
                  onClick={handleSuspend}
                  role="menuitem"
                  type="button"
                >
                  <SuspendIcon />
                  Suspend card
                </button>
                <button
                  className="session-overflow-item danger"
                  onClick={handleDelete}
                  role="menuitem"
                  type="button"
                >
                  <DeleteIcon />
                  Delete card
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 3L5 8l5 5" />
    </svg>
  );
}

function OverflowIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <circle cx="4" cy="8" r="1.3" />
      <circle cx="8" cy="8" r="1.3" />
      <circle cx="12" cy="8" r="1.3" />
    </svg>
  );
}

function SuspendIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="3" height="8" rx="0.5" />
      <rect x="7" y="2" width="3" height="8" rx="0.5" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M2 3h8M4.5 3V2h3v1M3 3v7.5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V3" />
    </svg>
  );
}
