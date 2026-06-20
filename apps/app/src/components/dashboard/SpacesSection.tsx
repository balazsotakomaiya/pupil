import { PlusIcon } from "../icons/PlusIcon";
import { Button } from "../ui/Button";
import styles from "./Dashboard.module.css";
import { SpaceCard } from "./SpaceCard";
import type { SpaceCardData } from "./types";

type SpacesSectionProps = {
  onOpenCreateDialog: () => void;
  onOpenSpace: (spaceId: string) => void;
  spaces: SpaceCardData[];
};

export function SpacesSection({ onOpenCreateDialog, onOpenSpace, spaces }: SpacesSectionProps) {
  return (
    <section className="section">
      <div className="section-head">
        <span className="section-label">Spaces</span>
        <Button onClick={onOpenCreateDialog} type="button" variant="ghost">
          <PlusIcon />
          New Space
        </Button>
      </div>

      <div className={styles.spacesGrid}>
        {spaces.map((space) => (
          <SpaceCard key={space.id} onOpen={() => onOpenSpace(space.id)} space={space} />
        ))}
      </div>
    </section>
  );
}
