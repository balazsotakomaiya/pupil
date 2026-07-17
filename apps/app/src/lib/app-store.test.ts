import { describe, expect, it } from "vitest";
import { enableTauriRuntime, invokeMock } from "../test/tauri";
import { useAppStore } from "./app-store";

const NOW = Date.UTC(2026, 6, 17, 10, 0, 0);
const card = {
  id: "card-a",
  spaceId: "space-a",
  spaceName: "Space A",
  front: "Question",
  back: "Answer",
  tags: [],
  source: "manual" as const,
  state: 0,
  due: NOW,
  stability: 0,
  difficulty: 0,
  elapsedDays: 0,
  scheduledDays: 0,
  learningSteps: 0,
  reps: 0,
  lapses: 0,
  lastReview: null,
  createdAt: NOW,
  updatedAt: NOW,
  suspended: false,
};
const space = {
  id: "space-a",
  name: "Space A",
  cardCount: 1,
  dueTodayCount: 1,
  streak: 0,
  createdAt: NOW,
  updatedAt: NOW,
};
const dashboardStats = {
  dueToday: 1,
  globalStreak: 2,
  studiedToday: 1,
  studyDays: [],
  totalCards: 1,
};
const studySettings = { newCardsLimit: 20, newCardsToday: 0 };

function seedStore() {
  useAppStore.setState({
    cards: [card],
    dashboardStats,
    recentActivity: [],
    spaces: [space],
    spaceStats: [],
    studySettings,
  });
}
function respondTo(command: string) {
  switch (command) {
    case "get_bootstrap_state":
      return {
        appDataDir: "/data",
        databasePath: "/data/pupil.sqlite",
        appliedMigrations: [],
        pendingMigrations: [],
        backupCreated: false,
      };
    case "list_spaces":
      return [space];
    case "list_cards":
      return [card];
    case "get_dashboard_stats":
      return dashboardStats;
    case "list_space_stats":
      return [];
    case "list_recent_activity":
      return [];
    case "get_study_settings":
      return studySettings;
    case "refresh_tray_status":
      return undefined;
    default:
      throw new Error(`Unexpected command: ${command}`);
  }
}
function respondToMutation(command: string) {
  switch (command) {
    case "create_card":
      return { ...card, id: "card-created", front: "Created" };
    case "update_card":
      return { ...card, front: "Updated" };
    case "suspend_card":
      return { ...card, suspended: true };
    case "review_card":
      return { ...card, lastReview: NOW, reps: 1, state: 2 };
    case "create_space":
      return { ...space, id: "space-created", name: "Created" };
    case "rename_space":
      return { ...space, name: "Renamed" };
    case "save_study_settings":
      return { newCardsLimit: null, newCardsToday: 0 };
    case "delete_card":
    case "delete_space":
    case "reset_all_data":
      return undefined;
    default:
      return respondTo(command);
  }
}
function useDesktopResponses() {
  enableTauriRuntime();
  invokeMock.mockImplementation(async (command) => respondToMutation(command));
}

describe("app store", () => {
  it("initializes its full snapshot through public desktop boundaries", async () => {
    enableTauriRuntime();
    invokeMock.mockImplementation(async (command) => respondTo(command));
    await useAppStore.getState().initialize();
    expect(useAppStore.getState()).toMatchObject({
      bootstrapError: null,
      cards: [card],
      dashboardStats,
      isBootstrapping: false,
      spaces: [space],
      studySettings,
    });
    expect(invokeMock).toHaveBeenCalledWith("get_bootstrap_state", undefined);
  });
  it("exposes a bootstrap error without leaving the store loading", async () => {
    enableTauriRuntime();
    invokeMock.mockRejectedValueOnce(new Error("Database unavailable"));
    await useAppStore.getState().initialize();
    expect(useAppStore.getState()).toMatchObject({
      bootstrapError: "Database unavailable",
      isBootstrapping: false,
    });
  });

  it("adds a created card to store state", async () => {
    seedStore();
    useDesktopResponses();
    await useAppStore
      .getState()
      .createCard({ spaceId: "space-a", front: "Created", back: "Answer", tags: [] });
    expect(useAppStore.getState().cards).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "card-created" })]),
    );
    expect(invokeMock).toHaveBeenCalledWith("create_card", {
      input: { spaceId: "space-a", front: "Created", back: "Answer", tags: [] },
    });
  });
  it("updates a card in store state", async () => {
    seedStore();
    useDesktopResponses();
    await useAppStore
      .getState()
      .updateCard({ id: "card-a", spaceId: "space-a", front: "Updated", back: "Answer", tags: [] });
    expect(useAppStore.getState().cards).toEqual([expect.objectContaining({ front: "Updated" })]);
    expect(invokeMock).toHaveBeenCalledWith("update_card", {
      input: { id: "card-a", spaceId: "space-a", front: "Updated", back: "Answer", tags: [] },
    });
  });
  it("marks a card suspended in store state", async () => {
    seedStore();
    useDesktopResponses();
    await useAppStore.getState().suspendCard({ id: "card-a", suspended: true });
    expect(useAppStore.getState().cards).toEqual([expect.objectContaining({ suspended: true })]);
    expect(invokeMock).toHaveBeenCalledWith("suspend_card", {
      input: { id: "card-a", suspended: true },
    });
  });
  it("stores a reviewed card", async () => {
    seedStore();
    useDesktopResponses();
    await useAppStore.getState().reviewCard({ card, grade: 3 });
    expect(useAppStore.getState().cards).toEqual([expect.objectContaining({ reps: 1, state: 2 })]);
    expect(invokeMock).toHaveBeenCalledWith(
      "review_card",
      expect.objectContaining({ input: expect.objectContaining({ id: "card-a", grade: 3 }) }),
    );
  });
  it("removes a deleted card from store state", async () => {
    seedStore();
    useDesktopResponses();
    await useAppStore.getState().deleteCard({ id: "card-a" });
    expect(useAppStore.getState().cards).toEqual([]);
    expect(invokeMock).toHaveBeenCalledWith("delete_card", { id: "card-a" });
  });

  it("adds a created space to store state", async () => {
    seedStore();
    useDesktopResponses();
    await expect(useAppStore.getState().createSpace("Created")).resolves.toMatchObject({
      id: "space-created",
    });
    expect(useAppStore.getState().spaces).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "space-created" })]),
    );
    expect(invokeMock).toHaveBeenCalledWith("create_space", { name: "Created" });
  });
  it("renames a space and its local card labels", async () => {
    seedStore();
    useDesktopResponses();
    await expect(useAppStore.getState().renameSpace("space-a", "Renamed")).resolves.toMatchObject({
      name: "Renamed",
    });
    expect(useAppStore.getState().cards).toEqual([
      expect.objectContaining({ spaceName: "Renamed" }),
    ]);
    expect(invokeMock).toHaveBeenCalledWith("rename_space", { id: "space-a", name: "Renamed" });
  });
  it("saves study settings in store state", async () => {
    seedStore();
    useDesktopResponses();
    await useAppStore.getState().saveStudySettings(null);
    expect(useAppStore.getState()).toMatchObject({
      isSavingStudySettings: false,
      studySettings: { newCardsLimit: null, newCardsToday: 0 },
    });
    expect(invokeMock).toHaveBeenCalledWith("save_study_settings", { newCardsLimit: null });
  });
  it("removes a deleted space from store state", async () => {
    seedStore();
    enableTauriRuntime();
    let wasDeleted = false;
    invokeMock.mockImplementation(async (command) => {
      if (command === "delete_space") {
        wasDeleted = true;
        return undefined;
      }

      if (command === "list_spaces" && wasDeleted) {
        return [];
      }

      return respondToMutation(command);
    });
    await useAppStore.getState().deleteSpace("space-a");
    expect(useAppStore.getState().spaces).toEqual([]);
    expect(invokeMock).toHaveBeenCalledWith("delete_space", { id: "space-a" });
  });
  it("saves approved AI cards with the AI source", async () => {
    seedStore();
    useDesktopResponses();
    await useAppStore.getState().saveApprovedAiCards({
      cards: [{ front: "AI", back: "Answer", tags: [] }],
      spaceId: "space-a",
    });
    expect(invokeMock).toHaveBeenCalledWith("create_card", {
      input: { front: "AI", back: "Answer", tags: [], source: "ai", spaceId: "space-a" },
    });
  });
  it("reloads the store snapshot after reset", async () => {
    seedStore();
    useDesktopResponses();
    await useAppStore.getState().resetAllData();
    expect(useAppStore.getState()).toMatchObject({ cards: [card], spaces: [space], studySettings });
    expect(invokeMock).toHaveBeenCalledWith("reset_all_data", undefined);
  });
});
