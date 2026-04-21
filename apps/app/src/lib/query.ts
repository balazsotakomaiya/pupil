import { QueryClient } from "@tanstack/react-query";

const MUTATION_RETRY_COUNT = 0;
const QUERY_RETRY_COUNT = 1;
const QUERY_STALE_TIME_MS = 5_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      retry: MUTATION_RETRY_COUNT,
    },
    queries: {
      refetchOnWindowFocus: false,
      retry: QUERY_RETRY_COUNT,
      staleTime: QUERY_STALE_TIME_MS,
    },
  },
});

export const appQueryKeys = {
  bootstrap: ["bootstrap"] as const,
  cards: ["cards"] as const,
  dashboardStats: ["dashboardStats"] as const,
  recentActivity: ["recentActivity"] as const,
  spaceStats: ["spaceStats"] as const,
  spaces: ["spaces"] as const,
  studySettings: ["studySettings"] as const,
};

export async function invalidateAllAppData(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: appQueryKeys.cards }),
    client.invalidateQueries({ queryKey: appQueryKeys.dashboardStats }),
    client.invalidateQueries({ queryKey: appQueryKeys.recentActivity }),
    client.invalidateQueries({ queryKey: appQueryKeys.spaceStats }),
    client.invalidateQueries({ queryKey: appQueryKeys.spaces }),
    client.invalidateQueries({ queryKey: appQueryKeys.studySettings }),
  ]);
}

export async function invalidateAfterCardMutation(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: appQueryKeys.cards }),
    client.invalidateQueries({ queryKey: appQueryKeys.dashboardStats }),
    client.invalidateQueries({ queryKey: appQueryKeys.spaceStats }),
    client.invalidateQueries({ queryKey: appQueryKeys.spaces }),
  ]);
}

export async function invalidateAfterCardDeletion(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: appQueryKeys.cards }),
    client.invalidateQueries({ queryKey: appQueryKeys.dashboardStats }),
    client.invalidateQueries({ queryKey: appQueryKeys.spaces }),
  ]);
}

export async function invalidateAfterReview(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: appQueryKeys.cards }),
    client.invalidateQueries({ queryKey: appQueryKeys.dashboardStats }),
    client.invalidateQueries({ queryKey: appQueryKeys.recentActivity }),
    client.invalidateQueries({ queryKey: appQueryKeys.spaceStats }),
    client.invalidateQueries({ queryKey: appQueryKeys.spaces }),
    client.invalidateQueries({ queryKey: appQueryKeys.studySettings }),
  ]);
}
