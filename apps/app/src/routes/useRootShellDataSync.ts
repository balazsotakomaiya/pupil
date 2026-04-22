import { type UseQueryResult, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getTodayDayKey } from "../lib/daily-checkin";
import { log } from "../lib/log";
import { invalidateDateSensitiveAppData } from "../lib/query";
import { isTauriRuntime } from "../lib/runtime";
import { refreshTrayStatus } from "../lib/tray";

type QuerySyncState = Pick<UseQueryResult, "dataUpdatedAt" | "error" | "isPending">;

type RootShellDataSyncInput = {
  bootstrapQuery: QuerySyncState;
  dashboardStatsQuery: QuerySyncState;
  studySettingsQuery: QuerySyncState;
};

export function useRootShellDataSync({
  bootstrapQuery,
  dashboardStatsQuery,
  studySettingsQuery,
}: RootShellDataSyncInput) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let timeoutId = 0;
    let currentDayKey = getTodayDayKey();

    function syncDaySensitiveQueries() {
      const nextDayKey = getTodayDayKey();

      if (nextDayKey === currentDayKey) {
        return;
      }

      currentDayKey = nextDayKey;
      void invalidateDateSensitiveAppData(queryClient);
    }

    function scheduleNextDayRefresh() {
      const nextMidnight = new Date();
      nextMidnight.setHours(24, 0, 1, 0);

      timeoutId = window.setTimeout(
        () => {
          syncDaySensitiveQueries();
          scheduleNextDayRefresh();
        },
        Math.max(1_000, nextMidnight.getTime() - Date.now()),
      );
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        syncDaySensitiveQueries();
      }
    }

    window.addEventListener("focus", syncDaySensitiveQueries);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    scheduleNextDayRefresh();

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", syncDaySensitiveQueries);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    if (
      bootstrapQuery.isPending ||
      dashboardStatsQuery.isPending ||
      studySettingsQuery.isPending ||
      bootstrapQuery.error ||
      dashboardStatsQuery.error ||
      studySettingsQuery.error
    ) {
      return;
    }

    void refreshTrayStatus().catch((error: unknown) => {
      log.warn("Failed to refresh tray status.", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, [
    bootstrapQuery.dataUpdatedAt,
    bootstrapQuery.error,
    bootstrapQuery.isPending,
    dashboardStatsQuery.dataUpdatedAt,
    dashboardStatsQuery.error,
    dashboardStatsQuery.isPending,
    studySettingsQuery.dataUpdatedAt,
    studySettingsQuery.error,
    studySettingsQuery.isPending,
  ]);
}
