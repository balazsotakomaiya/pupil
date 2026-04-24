import { useNavigate } from "@tanstack/react-router";
import { Dashboard } from "../../components/dashboard";
import { ScreenErrorBoundary } from "../../components/ErrorBoundary";
import {
  useCardsQuery,
  useDashboardStatsQuery,
  useRecentActivityQuery,
  useSpaceStatsQuery,
  useSpacesQuery,
  useStudyQueueSnapshotQuery,
  useStudySettingsQuery,
} from "../../lib/app-queries";
import {
  dismissDailyCheckIn,
  getDismissedDailyCheckInDay,
  getTodayDayKey,
} from "../../lib/daily-checkin";
import {
  buildActivity,
  buildSpaceCards,
  buildStats,
  buildStreakCells,
  buildStudySummary,
  shouldShowDailyCheckInPrompt,
} from "../../lib/derived";
import {
  FALLBACK_ACTIVITY,
  FALLBACK_SPACES,
  FALLBACK_STATS,
  FALLBACK_STUDY_SUMMARY,
} from "../../lib/seed-data";
import { buildStudyQueueCountMap, buildStudyQueueSnapshot } from "../../lib/study-queue";
import { computeNewCardsBudget } from "../../lib/study-settings";
import { useShellActions } from "../root-shell";

export function DashboardPage() {
  const navigate = useNavigate();
  const { openCreateDialog } = useShellActions();
  const cards = useCardsQuery().data ?? [];
  const spaces = useSpacesQuery().data ?? [];
  const dashboardStats = useDashboardStatsQuery().data ?? null;
  const studyQueueSnapshotQuery = useStudyQueueSnapshotQuery();
  const recentActivity = useRecentActivityQuery().data ?? [];
  const spaceStats = useSpaceStatsQuery().data ?? [];
  const studySettings = useStudySettingsQuery().data ?? { newCardsLimit: null, newCardsToday: 0 };
  const hasRealSpaces = spaces.length > 0;
  const now = Date.now();
  const todayDayKey = getTodayDayKey(now);
  const dismissedDailyCheckInDay = getDismissedDailyCheckInDay();
  const spaceStatsById = new Map(spaceStats.map((entry) => [entry.spaceId, entry]));
  const localQueueSnapshot = buildStudyQueueSnapshot(
    cards,
    now,
    computeNewCardsBudget(studySettings.newCardsLimit, studySettings.newCardsToday),
  );
  const queueSnapshot = studyQueueSnapshotQuery.data
    ? {
        actionableDueBySpace: buildStudyQueueCountMap(
          studyQueueSnapshotQuery.data.actionableDueBySpace,
        ),
        actionableDueCount: studyQueueSnapshotQuery.data.actionableDueCount,
        admittedCardIds: localQueueSnapshot.admittedCardIds,
        gatedNewCount: studyQueueSnapshotQuery.data.gatedNewCount,
        overdueReviewCount: studyQueueSnapshotQuery.data.overdueReviewCount,
      }
    : localQueueSnapshot;
  const summarySpaces = spaces.map((space) => ({
    ...space,
    dueTodayCount: queueSnapshot.actionableDueBySpace.get(space.id) ?? 0,
  }));
  const studyDashboardStats = dashboardStats
    ? {
        ...dashboardStats,
        dueToday: queueSnapshot.actionableDueCount,
      }
    : null;
  const globalStreak = dashboardStats?.globalStreak ?? (hasRealSpaces ? 0 : 14);
  const studySummary =
    hasRealSpaces && studyDashboardStats
      ? buildStudySummary(summarySpaces, studyDashboardStats, queueSnapshot.gatedNewCount)
      : FALLBACK_STUDY_SUMMARY;
  const isDailyCheckInActive =
    hasRealSpaces && studyDashboardStats
      ? shouldShowDailyCheckInPrompt(studyDashboardStats, dismissedDailyCheckInDay, todayDayKey)
      : false;
  const stats =
    hasRealSpaces && studyDashboardStats
      ? buildStats(studyDashboardStats, queueSnapshot.gatedNewCount)
      : FALLBACK_STATS;
  const spaceCards = hasRealSpaces
    ? buildSpaceCards(summarySpaces, cards, spaceStatsById, now)
    : FALLBACK_SPACES;
  const activity = hasRealSpaces ? buildActivity(recentActivity, now) : FALLBACK_ACTIVITY;
  const streakCells = buildStreakCells(dashboardStats?.studyDays ?? [], hasRealSpaces, now);

  return (
    <ScreenErrorBoundary
      onReset={() => void navigate({ to: "/" })}
      screen="dashboard"
      title="Dashboard unavailable"
    >
      <Dashboard
        activity={activity}
        isDailyCheckInActive={isDailyCheckInActive}
        onOpenCreateDialog={openCreateDialog}
        onOpenSpace={(spaceId) => void navigate({ to: "/spaces/$spaceId", params: { spaceId } })}
        onStudyPrimaryAction={
          hasRealSpaces
            ? () => {
                if (studyDashboardStats?.dueToday) {
                  dismissDailyCheckIn(todayDayKey);
                }
                void navigate({ to: "/study" });
              }
            : openCreateDialog
        }
        onSelectSpaceForStudy={
          hasRealSpaces
            ? (spaceId) => {
                void navigate({ to: "/spaces/$spaceId/study", params: { spaceId } });
              }
            : undefined
        }
        spaces={spaceCards}
        studySpaceOptions={summarySpaces}
        stats={stats}
        streakCells={streakCells}
        streakCount={globalStreak}
        studySummary={studySummary}
      />
    </ScreenErrorBoundary>
  );
}
