import { Button } from "../Button";
import { EyeLogo } from "../brand";
import { BackIcon } from "../icons/BackIcon";
import { DeleteIcon } from "../icons/DeleteIcon";
import { EditIcon } from "../icons/EditIcon";
import { ImportIcon } from "../icons/ImportIcon";
import { MoreVerticalIcon } from "../icons/MoreVerticalIcon";
import { PlusIcon } from "../icons/PlusIcon";
import { SparklesIcon } from "../icons/SparklesIcon";
import { Menu, MenuItem } from "../Menu";
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
  return (
    <div className={styles.titlebar} data-window-drag>
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
        <Menu
          label="Space actions"
          trigger={(props, { isOpen }) => (
            <Button
              {...props}
              aria-label="More actions"
              className={isOpen ? styles.titlebarActionActive : undefined}
              size="iconCompact"
              variant="outline"
            >
              <MoreVerticalIcon />
            </Button>
          )}
        >
          <MenuItem icon={<EditIcon />} onSelect={onOpenRenameDialog}>
            Rename space
          </MenuItem>
          <MenuItem icon={<DeleteIcon />} onSelect={onOpenDeleteDialog} tone="danger">
            Delete space
          </MenuItem>
        </Menu>
      </div>
    </div>
  );
}
