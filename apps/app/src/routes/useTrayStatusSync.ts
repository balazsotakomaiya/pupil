import type { UseQueryResult } from "@tanstack/react-query";
import { useEffect } from "react";
import { log } from "../lib/log";
import { isTauriRuntime } from "../lib/runtime";
import { refreshTrayStatus } from "../lib/tray";

type QuerySyncState = Pick<UseQueryResult, "dataUpdatedAt" | "error" | "isPending">;

type TrayStatusSyncInput = {
  bootstrapQuery: QuerySyncState;
  dashboardStatsQuery: QuerySyncState;
  studySettingsQuery: QuerySyncState;
};

export function useTrayStatusSync({
  bootstrapQuery,
  dashboardStatsQuery,
  studySettingsQuery,
}: TrayStatusSyncInput) {
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
