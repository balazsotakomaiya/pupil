import { ActivitySection } from "./ActivitySection";
import { SpacesSection } from "./SpacesSection";
import { StatsSection } from "./StatsSection";
import { StudySection } from "./StudySection";
import type {
  ActivityItem,
  SpaceCardData,
  StatCardData,
  StreakCellData,
  StudySummary,
} from "./types";

type DashboardProps = {
  activity: ActivityItem[];
  onOpenCreateDialog: () => void;
  onOpenSpace: (spaceId: string) => void;
  onStudyPrimaryAction?: () => void;
  spaces: SpaceCardData[];
  stats: StatCardData[];
  streakCells: StreakCellData[];
  streakCount: number;
  studySummary: StudySummary;
};

export function Dashboard({
  activity,
  onOpenCreateDialog,
  onOpenSpace,
  onStudyPrimaryAction,
  spaces,
  stats,
  streakCells,
  streakCount,
  studySummary,
}: DashboardProps) {
  return (
    <div className="page">
      <StudySection onPrimaryAction={onStudyPrimaryAction} summary={studySummary} />
      <div className="ruler-divider" />

      <StatsSection stats={stats} />
      <div className="ruler-divider" />

      <SpacesSection
        onOpenCreateDialog={onOpenCreateDialog}
        onOpenSpace={onOpenSpace}
        spaces={spaces}
      />
      <div className="ruler-divider" />

      <ActivitySection
        activity={activity}
        streakCells={streakCells}
        streakCount={streakCount}
      />

      <div className="page-end" />
    </div>
  );
}
