import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      retry: 0,
    },
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5_000,
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
