import type { SpaceSummary } from "../../lib/spaces";
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
  isDailyCheckInActive?: boolean;
  onOpenCreateDialog: () => void;
  onOpenSpace: (spaceId: string) => void;
  onSelectSpaceForStudy?: (spaceId: string) => void;
  onStudyPrimaryAction?: () => void;
  spaces: SpaceCardData[];
  stats: StatCardData[];
  streakCells: StreakCellData[];
  streakCount: number;
  studySpaceOptions: SpaceSummary[];
  studySummary: StudySummary;
};

export function Dashboard({
  activity,
  isDailyCheckInActive,
  onOpenCreateDialog,
  onOpenSpace,
  onSelectSpaceForStudy,
  onStudyPrimaryAction,
  spaces,
  stats,
  streakCells,
  streakCount,
  studySpaceOptions,
  studySummary,
}: DashboardProps) {
  return (
    <div className="page">
      <StudySection
        isDailyCheckInActive={isDailyCheckInActive}
        onPrimaryAction={onStudyPrimaryAction}
        onSelectSpaceForStudy={onSelectSpaceForStudy}
        spaces={studySpaceOptions}
        summary={studySummary}
      />
      <div className="ruler-divider" />

      <StatsSection stats={stats} />
      <div className="ruler-divider" />

      <SpacesSection
        onOpenCreateDialog={onOpenCreateDialog}
        onOpenSpace={onOpenSpace}
        spaces={spaces}
      />
      <div className="ruler-divider" />

      <ActivitySection activity={activity} streakCells={streakCells} streakCount={streakCount} />

      <div className="page-end" />
    </div>
  );
}
