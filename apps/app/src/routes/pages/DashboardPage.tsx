import { useNavigate } from "@tanstack/react-router";
import { Dashboard } from "../../components/dashboard";
import { ScreenErrorBoundary } from "../../components/ErrorBoundary";
import {
  useCardsQuery,
  useDashboardStatsQuery,
  useRecentActivityQuery,
  useSpaceStatsQuery,
  useSpacesQuery,
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
import { useShellActions } from "../root-shell";

export function DashboardPage() {
  const navigate = useNavigate();
  const { openCreateDialog } = useShellActions();
  const cards = useCardsQuery().data ?? [];
  const spaces = useSpacesQuery().data ?? [];
  const dashboardStats = useDashboardStatsQuery().data ?? null;
  const recentActivity = useRecentActivityQuery().data ?? [];
  const spaceStats = useSpaceStatsQuery().data ?? [];
  const hasRealSpaces = spaces.length > 0;
  const now = Date.now();
  const todayDayKey = getTodayDayKey(now);
  const dismissedDailyCheckInDay = getDismissedDailyCheckInDay();
  const spaceStatsById = new Map(spaceStats.map((entry) => [entry.spaceId, entry]));
  const globalStreak = dashboardStats?.globalStreak ?? (hasRealSpaces ? 0 : 14);
  const studySummary =
    hasRealSpaces && dashboardStats
      ? buildStudySummary(spaces, dashboardStats)
      : FALLBACK_STUDY_SUMMARY;
  const isDailyCheckInActive =
    hasRealSpaces && dashboardStats
      ? shouldShowDailyCheckInPrompt(dashboardStats, dismissedDailyCheckInDay, todayDayKey)
      : false;
  const stats = hasRealSpaces && dashboardStats ? buildStats(dashboardStats) : FALLBACK_STATS;
  const spaceCards = hasRealSpaces
    ? buildSpaceCards(spaces, cards, spaceStatsById, now)
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
                if (dashboardStats?.dueToday) {
                  dismissDailyCheckIn(todayDayKey);
                }
                void navigate({ to: "/study" });
              }
            : openCreateDialog
        }
        onStudySecondaryAction={
          hasRealSpaces
            ? () => {
                const targetSpace =
                  [...spaces].sort(
                    (left, right) =>
                      right.dueTodayCount - left.dueTodayCount || right.updatedAt - left.updatedAt,
                  )[0] ?? null;

                if (targetSpace) {
                  void navigate({ to: "/spaces/$spaceId", params: { spaceId: targetSpace.id } });
                }
              }
            : undefined
        }
        spaces={spaceCards}
        stats={stats}
        streakCells={streakCells}
        streakCount={globalStreak}
        studySummary={studySummary}
      />
    </ScreenErrorBoundary>
  );
}
