import { useState } from "react";
import { BackIcon } from "../icons/BackIcon";
import { DeleteIcon } from "../icons/DeleteIcon";
import { MoreHorizontalIcon } from "../icons/MoreHorizontalIcon";
import { SuspendIcon } from "../icons/SuspendIcon";
import { UndoIcon } from "../icons/UndoIcon";
import { Menu } from "../ui/Menu";
import { MenuItem } from "../ui/MenuItem";
import styles from "./Study.module.css";
import type { StudyCardRecord } from "./types";

type StudyBarProps = {
  canUndo: boolean;
  current: number;
  currentCard: StudyCardRecord | null;
  isSuspended: boolean;
  isUndoing: boolean;
  onDeleteCard: () => void;
  onEnd: () => void;
  onSuspendCard: () => void;
  onUndo: () => void;
  scopeLabel: string;
  total: number;
};

export function StudyBar({
  canUndo,
  current,
  currentCard,
  isSuspended,
  isUndoing,
  onDeleteCard,
  onEnd,
  onSuspendCard,
  onUndo,
  scopeLabel,
  total,
}: StudyBarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function handleSuspend() {
    setIsMenuOpen(false);
    onSuspendCard();
  }

  function handleDelete() {
    setIsMenuOpen(false);
    onDeleteCard();
  }

  return (
    <div className={styles.sessionBar}>
      <div className={styles.sessionBarLeft}>
        <button className={styles.sessionExitBtn} onClick={onEnd} type="button">
          <BackIcon />
          End
        </button>
        <span className={styles.sessionScope}>{scopeLabel}</span>
      </div>

      <div className={styles.sessionBarRight}>
        <span className={styles.sessionCounter}>
          <strong>{current}</strong> / <span>{total}</span>
        </span>

        <button
          aria-label="Undo last review"
          className={styles.sessionUndoBtn}
          disabled={!canUndo || isUndoing}
          onClick={onUndo}
          title={`Undo last review (${UNDO_SHORTCUT_HINT})`}
          type="button"
        >
          <UndoIcon />
        </button>

        {currentCard && !isSuspended ? (
          <div className={styles.sessionQuickActions}>
            <Menu
              isOpen={isMenuOpen}
              onOpenChange={setIsMenuOpen}
              trigger={
                <button
                  aria-label="Card actions"
                  className={`${styles.sessionOverflowBtn}${isMenuOpen ? ` ${styles.active}` : ""}`}
                  onClick={() => setIsMenuOpen((open) => !open)}
                  type="button"
                >
                  <MoreHorizontalIcon />
                </button>
              }
            >
              <MenuItem onClick={handleSuspend}>
                <SuspendIcon />
                Suspend card
              </MenuItem>
              <MenuItem variant="danger" onClick={handleDelete}>
                <DeleteIcon />
                Delete card
              </MenuItem>
            </Menu>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const UNDO_SHORTCUT_HINT =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
    ? "⌘Z"
    : "Ctrl+Z";
