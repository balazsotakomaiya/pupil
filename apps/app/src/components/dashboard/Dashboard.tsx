import type { FormEvent } from "react";
import { ActivitySection } from "./ActivitySection";
import { DashboardTitlebar } from "./DashboardTitlebar";
import { NewSpaceDialog } from "./NewSpaceDialog";
import { RulersOverlay } from "./RulersOverlay";
import { SpacesSection } from "./SpacesSection";
import { StatsSection } from "./StatsSection";
import { StudySection } from "./StudySection";
import type {
  ActivityItem,
  DashboardTab,
  SpaceCardData,
  StatCardData,
  StreakCellData,
  StudySummary,
} from "./types";

type DashboardProps = {
  activity: ActivityItem[];
  isCreateDialogOpen: boolean;
  isCreatingSpace: boolean;
  newSpaceError: string | null;
  newSpaceName: string;
  onCloseCreateDialog: () => void;
  onCreateNameChange: (value: string) => void;
  onOpenCreateDialog: () => void;
  onStudyPrimaryAction?: () => void;
  onSubmitCreateDialog: (event: FormEvent<HTMLFormElement>) => void;
  spaces: SpaceCardData[];
  stats: StatCardData[];
  streakCells: StreakCellData[];
  streakCount: number;
  studySummary: StudySummary;
  tabs: DashboardTab[];
};

export function Dashboard({
  activity,
  isCreateDialogOpen,
  isCreatingSpace,
  newSpaceError,
  newSpaceName,
  onCloseCreateDialog,
  onCreateNameChange,
  onOpenCreateDialog,
  onStudyPrimaryAction,
  onSubmitCreateDialog,
  spaces,
  stats,
  streakCells,
  streakCount,
  studySummary,
  tabs,
}: DashboardProps) {
  return (
    <>
      <RulersOverlay />
      <div className="dashboard-shell">
        <DashboardTitlebar onOpenCreateDialog={onOpenCreateDialog} tabs={tabs} />

        <div className="page">
          <StudySection onPrimaryAction={onStudyPrimaryAction} summary={studySummary} />
          <div className="ruler-divider" />

          <StatsSection stats={stats} />
          <div className="ruler-divider" />

          <SpacesSection onOpenCreateDialog={onOpenCreateDialog} spaces={spaces} />
          <div className="ruler-divider" />

          <ActivitySection
            activity={activity}
            streakCells={streakCells}
            streakCount={streakCount}
          />

          <div className="page-end" />
        </div>
      </div>

      {isCreateDialogOpen ? (
        <NewSpaceDialog
          error={newSpaceError}
          isSubmitting={isCreatingSpace}
          onChange={onCreateNameChange}
          onClose={onCloseCreateDialog}
          onSubmit={onSubmitCreateDialog}
          value={newSpaceName}
        />
      ) : null}
    </>
  );
}
