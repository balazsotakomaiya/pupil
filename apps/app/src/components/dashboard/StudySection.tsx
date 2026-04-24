import { useEffect, useRef, useState } from "react";
import type { SpaceSummary } from "../../lib/spaces";
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
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPickerOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isPickerOpen]);

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
          <div className="more-menu-wrap" ref={pickerRef}>
            <button
              className="study-btn-secondary"
              disabled={!hasStudyableSpaces || !onSelectSpaceForStudy}
              onClick={() => setIsPickerOpen((open) => !open)}
              type="button"
            >
              {summary.secondaryActionLabel}
            </button>
            {isPickerOpen && hasStudyableSpaces && (
              <div className={`more-menu ${styles.spacePickerMenu}`}>
                {studyableSpaces.map((space) => (
                  <button
                    className={`more-menu-item ${styles.spacePickerItem}`}
                    key={space.id}
                    onClick={() => {
                      setIsPickerOpen(false);
                      onSelectSpaceForStudy?.(space.id);
                    }}
                    type="button"
                  >
                    <span className={styles.spacePickerName}>{space.name}</span>
                    <span className={styles.spacePickerStats}>
                      {space.dueTodayCount > 0 && (
                        <span className={styles.spacePickerDue}>{space.dueTodayCount} due</span>
                      )}
                      <span>{space.cardCount} cards</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="study-btn" onClick={onPrimaryAction} type="button">
            {summary.primaryActionLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
