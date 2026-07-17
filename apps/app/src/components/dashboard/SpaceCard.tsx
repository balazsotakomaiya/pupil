import styles from "./Dashboard.module.css";
import type { SpaceCardData } from "./types";

type SpaceCardProps = {
  onOpen: () => void;
  space: SpaceCardData;
};

export function SpaceCard({ onOpen, space }: SpaceCardProps) {
  return (
    <button className={styles.spaceCard} onClick={onOpen} type="button">
      <div className={styles.spaceTop}>
        <span className={styles.spaceName}>{space.name}</span>
        {space.streakLabel ? (
          <span className={styles.spaceStreak}>
            <span className="streak-dot" />
            {space.streakLabel}
          </span>
        ) : (
          <span className={styles.spaceStreak} />
        )}
      </div>
      <div className={styles.spaceDesc}>{space.description}</div>
      <div className={styles.spaceMeta}>
        {space.meta.map((item) => (
          <div className={styles.spaceMetaItem} key={`${space.id}-${item.label}`}>
            <span className={styles.spaceMetaVal}>{item.value}</span>
            <span className={styles.spaceMetaLabel}>{item.label}</span>
          </div>
        ))}
        <span className={styles.spaceUpdated} title={space.updatedLabel}>
          {space.updatedLabel}
        </span>
      </div>
    </button>
  );
}
