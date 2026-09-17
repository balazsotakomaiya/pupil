import { describe, expect, it, vi } from "vitest";
import { createTestQueryClient, enableTauriRuntime, invokeMock } from "../test/tauri";
import { dismissDailyCheckIn, getDismissedDailyCheckInDay, getTodayDayKey } from "./daily-checkin";
import {
  NotificationType,
  notifyError,
  notifyInfo,
  notifySuccess,
  useNotificationStore,
} from "./notifications";
import { dismissOnboarding, hasDismissedOnboarding, resetOnboarding } from "./onboarding";
import {
  appQueryKeys,
  invalidateAfterCardDeletion,
  invalidateAfterCardMutation,
  invalidateAfterReview,
  invalidateAllAppData,
  invalidateDateSensitiveAppData,
} from "./query";
import { getStudySettings, saveStudySettings } from "./study-settings";

const NOW = Date.UTC(2026, 6, 17, 10, 0, 0);

function seedQueryKeys() {
  const client = createTestQueryClient();
  for (const key of Object.values(appQueryKeys)) {
    client.setQueryData(key, { key });
  }
  client.setQueryData(["unrelated"], true);
  return client;
}

function invalidatedKeys(client: ReturnType<typeof seedQueryKeys>) {
  return Object.entries(appQueryKeys)
    .filter(([, key]) => client.getQueryState(key)?.isInvalidated)
    .map(([name]) => name)
    .sort();
}

describe("query invalidation contracts", () => {
  it("invalidates all application data but not unrelated queries", async () => {
    const client = seedQueryKeys();

    await invalidateAllAppData(client);

    expect(invalidatedKeys(client)).toEqual([
      "cards",
      "dashboardStats",
      "recentActivity",
      "spaceStats",
      "spaces",
      "studyQueueSnapshot",
      "studySettings",
    ]);
    expect(client.getQueryState(["unrelated"])?.isInvalidated).toBe(false);
  });

  it("invalidates date-sensitive queries", async () => {
    const dateClient = seedQueryKeys();
    await invalidateDateSensitiveAppData(dateClient);
    expect(invalidatedKeys(dateClient)).toEqual([
      "dashboardStats",
      "studyQueueSnapshot",
      "studySettings",
    ]);
  });

  it("invalidates affected queries after a card mutation", async () => {
    const cardClient = seedQueryKeys();
    await invalidateAfterCardMutation(cardClient);
    expect(invalidatedKeys(cardClient)).toEqual([
      "cards",
      "dashboardStats",
      "spaceStats",
      "spaces",
      "studyQueueSnapshot",
    ]);
  });

  it("invalidates affected queries after a card deletion", async () => {
    const deletionClient = seedQueryKeys();
    await invalidateAfterCardDeletion(deletionClient);
    expect(invalidatedKeys(deletionClient)).toEqual([
      "cards",
      "dashboardStats",
      "spaces",
      "studyQueueSnapshot",
    ]);
  });

  it("invalidates affected queries after a review", async () => {
    const reviewClient = seedQueryKeys();
    await invalidateAfterReview(reviewClient);
    expect(invalidatedKeys(reviewClient)).toEqual([
      "cards",
      "dashboardStats",
      "recentActivity",
      "spaceStats",
      "spaces",
      "studyQueueSnapshot",
      "studySettings",
    ]);
  });
});

describe("browser-persisted client state", () => {
  it("persists onboarding dismissal", () => {
    expect(hasDismissedOnboarding()).toBe(false);
    dismissOnboarding();
    expect(hasDismissedOnboarding()).toBe(true);
    resetOnboarding();
    expect(hasDismissedOnboarding()).toBe(false);
  });

  it("persists the dismissed daily check-in day", () => {
    const day = getTodayDayKey(NOW);
    expect(dismissDailyCheckIn(day)).toBe(day);
    expect(getDismissedDailyCheckInDay()).toBe(day);
  });

  it("adds typed notifications and dismisses only the selected item", () => {
    const initialState = useNotificationStore.getInitialState();
    useNotificationStore.setState(initialState, true);
    const successId = notifySuccess("Saved", "Cards");
    const infoId = notifyInfo("Syncing");
    const errorId = notifyError(
      { code: "NETWORK", message: "Offline", name: "NetworkError", severity: "infra" },
      "Sync failed",
    );

    expect(useNotificationStore.getState().items).toEqual([
      expect.objectContaining({ id: successId, type: NotificationType.Success }),
      expect.objectContaining({ id: infoId, type: NotificationType.Info }),
      expect.objectContaining({ id: errorId, message: "Offline", type: NotificationType.Error }),
    ]);
    useNotificationStore.getState().dismiss(infoId);
    expect(useNotificationStore.getState().items.map((item) => item.id)).toEqual([
      successId,
      errorId,
    ]);
  });

  it("reads the browser study limit and counts distinct new cards reviewed today", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    window.localStorage.setItem("pupil.web.study_settings", JSON.stringify({ newCardsLimit: 15 }));
    window.localStorage.setItem(
      "pupil.web.review_logs",
      JSON.stringify([
        { cardId: "card-a", reviewTime: NOW, state: 0 },
        { cardId: "card-a", reviewTime: NOW, state: 0 },
        { cardId: "card-b", reviewTime: NOW, state: 0 },
        { cardId: "old", reviewTime: NOW - 24 * 60 * 60 * 1000, state: 0 },
        { cardId: "review", reviewTime: NOW, state: 2 },
      ]),
    );

    await expect(getStudySettings()).resolves.toEqual({ newCardsLimit: 15, newCardsToday: 2 });
  });

  it("saves the browser study limit while retaining today's count", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    window.localStorage.setItem(
      "pupil.web.review_logs",
      JSON.stringify([{ cardId: "card-a", reviewTime: NOW, state: 0 }]),
    );
    await expect(saveStudySettings(null)).resolves.toEqual({
      newCardsLimit: null,
      newCardsToday: 1,
    });
  });
});

describe("study settings desktop commands", () => {
  it("gets study settings through the native boundary", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce({ newCardsLimit: 20, newCardsToday: 3 });

    await expect(getStudySettings()).resolves.toEqual({ newCardsLimit: 20, newCardsToday: 3 });
    expect(invokeMock).toHaveBeenCalledWith("get_study_settings", undefined);
  });

  it("saves study settings through the native boundary", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce({ newCardsLimit: null, newCardsToday: 3 });

    await expect(saveStudySettings(null)).resolves.toEqual({
      newCardsLimit: null,
      newCardsToday: 3,
    });
    expect(invokeMock).toHaveBeenCalledWith("save_study_settings", { newCardsLimit: null });
  });
});
