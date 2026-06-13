import { useState } from "react";
import { EyeLogo } from "../dashboard/EyeLogo";
import { BackIcon } from "../icons/BackIcon";
import { DeleteIcon } from "../icons/DeleteIcon";
import { EditIcon } from "../icons/EditIcon";
import { ImportIcon } from "../icons/ImportIcon";
import { MoreVerticalIcon } from "../icons/MoreVerticalIcon";
import { PlusIcon } from "../icons/PlusIcon";
import { SparklesIcon } from "../icons/SparklesIcon";
import { Menu } from "../ui/Menu";
import { MenuItem } from "../ui/MenuItem";
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

  return (
    <div className={styles.titlebar}>
      <div className={styles.titlebarLeft}>
        <div className={styles.titlebarLogo}>
          <EyeLogo />
          <span className={styles.titlebarLogoText}>pupil</span>
        </div>

        <div className={styles.titlebarSep} />

        <button className={styles.backBtn} onClick={onBack} type="button">
          <BackIcon />
          Dashboard
        </button>

        <div className={styles.titlebarSep} />

        <span className={styles.breadcrumbName}>{spaceName}</span>
      </div>

      <div className={styles.titlebarRight}>
        <button className={styles.titlebarBtnLabel} onClick={onOpenNewCard} type="button">
          <PlusIcon />
          New Card
        </button>
        <button className={styles.titlebarBtnLabel} onClick={onOpenAiGenerate} type="button">
          <SparklesIcon />
          AI Generate
        </button>
        <button className={styles.titlebarBtnLabel} onClick={onOpenImport} type="button">
          <ImportIcon />
          Import
        </button>

        <Menu
          isOpen={isMenuOpen}
          onOpenChange={setIsMenuOpen}
          trigger={
            <button
              aria-expanded={isMenuOpen}
              aria-label="More actions"
              className={`${styles.titlebarBtn}${isMenuOpen ? ` ${styles.active}` : ""}`}
              onClick={() => setIsMenuOpen((open) => !open)}
              type="button"
            >
              <MoreVerticalIcon />
            </button>
          }
        >
          <MenuItem
            onClick={() => {
              setIsMenuOpen(false);
              onOpenRenameDialog();
            }}
          >
            <EditIcon />
            Rename space
          </MenuItem>
          <MenuItem
            variant="danger"
            onClick={() => {
              setIsMenuOpen(false);
              onOpenDeleteDialog();
            }}
          >
            <DeleteIcon />
            Delete space
          </MenuItem>
        </Menu>
      </div>
    </div>
  );
}
