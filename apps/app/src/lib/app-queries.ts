import { useQuery } from "@tanstack/react-query";
import { listRecentActivity } from "./activity";
import { loadBootstrapState } from "./bootstrap";
import { listCards } from "./cards";
import { appQueryKeys } from "./query";
import { listSpaces } from "./spaces";
import { getDashboardStats, listSpaceStats } from "./stats";
import { getStudyQueueSnapshot } from "./study-queue";
import { getStudySettings } from "./study-settings";

function useCoreQuery<T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) {
  return useQuery({
    queryKey,
    queryFn,
  });
}

export function useBootstrapQuery() {
  return useCoreQuery(appQueryKeys.bootstrap, () => loadBootstrapState());
}

export function useCardsQuery() {
  return useCoreQuery(appQueryKeys.cards, () => listCards());
}

export function useDashboardStatsQuery() {
  return useCoreQuery(appQueryKeys.dashboardStats, () => getDashboardStats());
}

export function useStudyQueueSnapshotQuery() {
  return useCoreQuery(appQueryKeys.studyQueueSnapshot, () => getStudyQueueSnapshot());
}

export function useRecentActivityQuery() {
  return useCoreQuery(appQueryKeys.recentActivity, () => listRecentActivity());
}

export function useSpaceStatsQuery() {
  return useCoreQuery(appQueryKeys.spaceStats, () => listSpaceStats());
}

export function useSpacesQuery() {
  return useCoreQuery(appQueryKeys.spaces, () => listSpaces());
}

export function useStudySettingsQuery() {
  return useCoreQuery(appQueryKeys.studySettings, () => getStudySettings());
}
