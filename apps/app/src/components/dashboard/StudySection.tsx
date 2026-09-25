import type { SpaceSummary } from "@pupil/core";
import { useState } from "react";
import { Button } from "../Button";
import { Menu, MenuItem } from "../Menu";
import styles from "./Dashboard.module.css";
import type { StudySummary } from "./types";

type StudySectionProps = {
  isDailyCheckInActive?: boolean;
  onPrimaryAction?: () => void;
  onSelectSpaceForStudy?: (spaceId: string) => void;
  spaces: SpaceSummary[];
  summary: StudySummary;
};

export function StudySection({
  isDailyCheckInActive = false,
  onPrimaryAction,
  onSelectSpaceForStudy,
  spaces,
  summary,
}: StudySectionProps) {
  const [tapped, setTapped] = useState(false);

  const studyableSpaces = spaces
    .filter((space) => space.cardCount > 0)
    .sort(
      (left, right) => right.dueTodayCount - left.dueTodayCount || right.updatedAt - left.updatedAt,
    );

  const hasStudyableSpaces = studyableSpaces.length > 0;

  return (
    <section className="study-section">
      <div className={`study-card${isDailyCheckInActive ? " daily-checkin-active" : ""}`}>
        <div className="study-left">
          <div className="study-eyebrow">
            <span className="live-dot" />
            {summary.eyebrow}
          </div>
          <div className="study-headline">{summary.headline}</div>
          <div className="study-sub">{summary.description}</div>
          {summary.breakdown.length > 0 ? (
            <div className={styles.studyBreakdown}>
              {summary.breakdown.map((item) => (
                <span className={styles.studyBreakdownItem} key={item.label}>
                  <strong>{item.value}</strong> {item.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="study-right">
          <Menu
            label="Choose a space to study"
            panelClassName={styles.spacePickerMenu}
            trigger={(props) => (
              <Button
                {...props}
                disabled={!hasStudyableSpaces || !onSelectSpaceForStudy}
                variant="outline"
              >
                {summary.secondaryActionLabel}
              </Button>
            )}
          >
            {studyableSpaces.map((space) => (
              <MenuItem
                className={styles.spacePickerItem}
                key={space.id}
                onSelect={() => onSelectSpaceForStudy?.(space.id)}
              >
                <span className={styles.spacePickerName}>{space.name}</span>
                <span className={styles.spacePickerStats}>
                  {space.dueTodayCount > 0 && (
                    <span className={styles.spacePickerDue}>{space.dueTodayCount} due</span>
                  )}
                  <span>{space.cardCount} cards</span>
                </span>
              </MenuItem>
            ))}
          </Menu>
          <Button
            className={`${styles.studyPrimaryAction}${tapped ? ` ${styles.studyPrimaryActionGlow}` : ""}`}
            onClick={() => {
              setTapped(true);
              onPrimaryAction?.();
            }}
            onAnimationEnd={() => {
              setTapped(false);
            }}
          >
            {summary.primaryActionLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}
