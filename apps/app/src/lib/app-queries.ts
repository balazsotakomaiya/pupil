import { useQuery } from "@tanstack/react-query";
import { loadAiSettings } from "./ai-settings";
import { loadBootstrapState } from "./bootstrap";
import { appQueryKeys } from "./query";
import { getStorage } from "./storage";

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
  return useCoreQuery(appQueryKeys.cards, () => getStorage().listCards());
}

export function useDashboardStatsQuery() {
  return useCoreQuery(appQueryKeys.dashboardStats, () => getStorage().getDashboardStats());
}

export function useStudyQueueSnapshotQuery() {
  return useCoreQuery(appQueryKeys.studyQueueSnapshot, () => getStorage().getStudyQueueSnapshot());
}

export function useRecentActivityQuery() {
  return useCoreQuery(appQueryKeys.recentActivity, () => getStorage().listRecentActivity());
}

export function useSpaceStatsQuery() {
  return useCoreQuery(appQueryKeys.spaceStats, () => getStorage().listSpaceStats());
}

export function useSpacesQuery() {
  return useCoreQuery(appQueryKeys.spaces, () => getStorage().listSpaces());
}

export function useStudySettingsQuery() {
  return useCoreQuery(appQueryKeys.studySettings, () => getStorage().getStudySettings());
}

export function useAiSettingsQuery() {
  return useCoreQuery(appQueryKeys.aiSettings, () => loadAiSettings());
}
