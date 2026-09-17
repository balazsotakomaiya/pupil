import { useEffect, useRef, useState } from "react";
import { Button } from "../Button";
import { EyeLogo } from "../dashboard/EyeLogo";
import { BackIcon } from "../icons/BackIcon";
import { DeleteIcon } from "../icons/DeleteIcon";
import { EditIcon } from "../icons/EditIcon";
import { ImportIcon } from "../icons/ImportIcon";
import { MoreVerticalIcon } from "../icons/MoreVerticalIcon";
import { PlusIcon } from "../icons/PlusIcon";
import { SparklesIcon } from "../icons/SparklesIcon";
import styles from "./AppTitlebar.module.css";

type SpaceDetailsTitlebarProps = {
  onBack: () => void;
  onOpenDeleteDialog: () => void;
  onOpenAiGenerate: () => void;
  onOpenImport: () => void;
  onOpenNewCard: () => void;
  onOpenRenameDialog: () => void;
  spaceName: string;
};

export function SpaceDetailsTitlebar({
  onBack,
  onOpenDeleteDialog,
  onOpenAiGenerate,
  onOpenImport,
  onOpenNewCard,
  onOpenRenameDialog,
  spaceName,
}: SpaceDetailsTitlebarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  return (
    <div className={styles.titlebar}>
      <div className={styles.titlebarLeft}>
        <div className={styles.titlebarLogo}>
          <EyeLogo />
          <span className={styles.titlebarLogoText}>pupil</span>
        </div>

        <div className={styles.titlebarSep} />

        <Button className={styles.backBtn} onClick={onBack} variant="bare">
          <BackIcon />
          Dashboard
        </Button>

        <div className={styles.titlebarSep} />

        <span className={styles.breadcrumbName}>{spaceName}</span>
      </div>

      <div className={styles.titlebarRight}>
        <Button onClick={onOpenNewCard} size="compact" variant="outline">
          <PlusIcon />
          New Card
        </Button>
        <Button onClick={onOpenAiGenerate} size="compact" variant="outline">
          <SparklesIcon />
          AI Generate
        </Button>
        <Button onClick={onOpenImport} size="compact" variant="outline">
          <ImportIcon />
          Import
        </Button>
        <div className="more-menu-wrap" ref={menuRef}>
          <Button
            aria-expanded={isMenuOpen}
            aria-label="More actions"
            className={isMenuOpen ? styles.titlebarActionActive : undefined}
            onClick={() => setIsMenuOpen((open) => !open)}
            size="iconCompact"
            variant="outline"
          >
            <MoreVerticalIcon />
          </Button>
          {isMenuOpen && (
            <div className="more-menu">
              <button
                className="more-menu-item"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenRenameDialog();
                }}
                type="button"
              >
                <EditIcon />
                Rename space
              </button>
              <button
                className="more-menu-item danger"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenDeleteDialog();
                }}
                type="button"
              >
                <DeleteIcon />
                Delete space
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
