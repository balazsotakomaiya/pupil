import {
  type CardRecord,
  type DashboardStats,
  DEFAULT_NEW_CARDS_LIMIT,
  type RecentActivityRecord,
  type SpaceStats,
  type SpaceSummary,
  type StudySettings,
} from "@pupil/core";
import { create } from "zustand";
import { loadBootstrapState } from "./bootstrap";
import { resetAllData as resetAllAppData } from "./data-actions";
import { sortCardRecords, sortSpaces } from "./derived";
import { getStorage } from "./storage";
import { refreshTrayStatus } from "./tray";

type AppDataSnapshot = {
  cards: CardRecord[];
  dashboardStats: DashboardStats | null;
  recentActivity: RecentActivityRecord[];
  spaces: SpaceSummary[];
  spaceStats: SpaceStats[];
  studySettings: StudySettings;
};

type AppStoreState = AppDataSnapshot & {
  bootstrapError: string | null;
  isBootstrapping: boolean;
  isMutatingCards: boolean;
  isSavingStudySettings: boolean;
};

type CreateCardInput = {
  back: string;
  front: string;
  spaceId: string;
  source?: CardRecord["source"];
  tags: string[];
};

type UpdateCardInput = {
  back: string;
  front: string;
  id: string;
  spaceId: string;
  tags: string[];
};

type DeleteCardInput = {
  id: string;
};

type SuspendCardInput = {
  id: string;
  suspended: boolean;
};

type ReviewCardInput = {
  card: CardRecord;
  grade: 1 | 2 | 3 | 4;
};

type SaveApprovedAiCardsInput = {
  cards: Array<{ back: string; front: string; tags: string[] }>;
  spaceId: string;
};

type AppStoreActions = {
  createCard: (input: CreateCardInput) => Promise<void>;
  createSpace: (name: string) => Promise<SpaceSummary>;
  deleteCard: (input: DeleteCardInput) => Promise<void>;
  deleteSpace: (spaceId: string) => Promise<void>;
  initialize: () => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshStudySettings: () => Promise<void>;
  renameSpace: (spaceId: string, name: string) => Promise<SpaceSummary>;
  resetAllData: () => Promise<void>;
  reviewCard: (input: ReviewCardInput) => Promise<CardRecord>;
  saveApprovedAiCards: (input: SaveApprovedAiCardsInput) => Promise<void>;
  saveStudySettings: (newCardsLimit: number | null) => Promise<void>;
  suspendCard: (input: SuspendCardInput) => Promise<CardRecord>;
  updateCard: (input: UpdateCardInput) => Promise<void>;
};

export type AppStore = AppStoreState & AppStoreActions;

const DEFAULT_STUDY_SETTINGS: StudySettings = {
  newCardsLimit: DEFAULT_NEW_CARDS_LIMIT,
  newCardsToday: 0,
};

const INITIAL_STATE: AppStoreState = {
  bootstrapError: null,
  cards: [],
  dashboardStats: null,
  isBootstrapping: true,
  isMutatingCards: false,
  isSavingStudySettings: false,
  recentActivity: [],
  spaces: [],
  spaceStats: [],
  studySettings: DEFAULT_STUDY_SETTINGS,
};

async function loadFullSnapshot(): Promise<AppDataSnapshot> {
  const [spaces, cards, dashboardStats, spaceStats, recentActivity, studySettings] =
    await Promise.all([
      getStorage().listSpaces(),
      getStorage().listCards(),
      getStorage().getDashboardStats(),
      getStorage().listSpaceStats(),
      getStorage().listRecentActivity(),
      getStorage().getStudySettings(),
    ]);

  return {
    cards,
    dashboardStats,
    recentActivity,
    spaces,
    spaceStats,
    studySettings,
  };
}

async function loadCardMutationSnapshot(): Promise<
  Pick<AppDataSnapshot, "dashboardStats" | "spaces" | "spaceStats">
> {
  const [spaces, dashboardStats, spaceStats] = await Promise.all([
    getStorage().listSpaces(),
    getStorage().getDashboardStats(),
    getStorage().listSpaceStats(),
  ]);

  return {
    dashboardStats,
    spaces,
    spaceStats,
  };
}

async function loadCardDeletionSnapshot(): Promise<
  Pick<AppDataSnapshot, "dashboardStats" | "spaces">
> {
  const [spaces, dashboardStats] = await Promise.all([
    getStorage().listSpaces(),
    getStorage().getDashboardStats(),
  ]);

  return {
    dashboardStats,
    spaces,
  };
}

async function loadReviewSnapshot(): Promise<
  Pick<
    AppDataSnapshot,
    "dashboardStats" | "recentActivity" | "spaces" | "spaceStats" | "studySettings"
  >
> {
  const [spaces, dashboardStats, spaceStats, recentActivity, studySettings] = await Promise.all([
    getStorage().listSpaces(),
    getStorage().getDashboardStats(),
    getStorage().listSpaceStats(),
    getStorage().listRecentActivity(),
    getStorage().getStudySettings(),
  ]);

  return {
    dashboardStats,
    recentActivity,
    spaces,
    spaceStats,
    studySettings,
  };
}

function syncTrayStatus() {
  void refreshTrayStatus().catch((error: unknown) => {
    console.error("Failed to refresh tray status.", error);
  });
}

export const useAppStore = create<AppStore>((set) => ({
  ...INITIAL_STATE,

  async initialize() {
    set({ bootstrapError: null, isBootstrapping: true });

    try {
      await loadBootstrapState();
      const snapshot = await loadFullSnapshot();

      set({
        ...snapshot,
        bootstrapError: null,
        isBootstrapping: false,
      });
      syncTrayStatus();
    } catch (error: unknown) {
      set({
        bootstrapError: error instanceof Error ? error.message : "Failed to load app state",
        isBootstrapping: false,
      });
    }
  },

  async refreshAll() {
    const snapshot = await loadFullSnapshot();
    set(snapshot);
    syncTrayStatus();
  },

  async refreshStudySettings() {
    const studySettings = await getStorage().getStudySettings();
    set({ studySettings });
  },

  async createCard(input) {
    set({ isMutatingCards: true });

    try {
      const createdCard = await getStorage().createCard(input);
      set((state) => ({
        cards: sortCardRecords([createdCard, ...state.cards]),
      }));

      const snapshot = await loadCardMutationSnapshot();
      set(snapshot);
      syncTrayStatus();
    } finally {
      set({ isMutatingCards: false });
    }
  },

  async updateCard(input) {
    set({ isMutatingCards: true });

    try {
      const updatedCard = await getStorage().updateCard(input);
      set((state) => ({
        cards: sortCardRecords(
          state.cards.map((card) => (card.id === updatedCard.id ? updatedCard : card)),
        ),
      }));

      const spaces = await getStorage().listSpaces();
      set({ spaces });
    } finally {
      set({ isMutatingCards: false });
    }
  },

  async deleteCard(input) {
    set({ isMutatingCards: true });

    try {
      await getStorage().deleteCard(input);
      set((state) => ({
        cards: state.cards.filter((card) => card.id !== input.id),
      }));

      const snapshot = await loadCardDeletionSnapshot();
      set(snapshot);
      syncTrayStatus();
    } finally {
      set({ isMutatingCards: false });
    }
  },

  async suspendCard(input) {
    set({ isMutatingCards: true });

    try {
      const updatedCard = await getStorage().suspendCard(input);
      set((state) => ({
        cards: state.cards.map((card) => (card.id === updatedCard.id ? updatedCard : card)),
      }));

      const snapshot = await loadCardDeletionSnapshot();
      set(snapshot);
      syncTrayStatus();

      return updatedCard;
    } finally {
      set({ isMutatingCards: false });
    }
  },

  async reviewCard(input) {
    set({ isMutatingCards: true });

    try {
      const updatedCard = await getStorage().reviewCard(input);
      set((state) => ({
        cards: sortCardRecords(
          state.cards.map((card) => (card.id === updatedCard.id ? updatedCard : card)),
        ),
      }));

      const snapshot = await loadReviewSnapshot();
      set(snapshot);
      syncTrayStatus();

      return updatedCard;
    } finally {
      set({ isMutatingCards: false });
    }
  },

  async createSpace(name) {
    const createdSpace = await getStorage().createSpace({ name });
    set((state) => ({
      spaces: sortSpaces([createdSpace, ...state.spaces]),
    }));
    return createdSpace;
  },

  async deleteSpace(spaceId) {
    await getStorage().deleteSpace({ id: spaceId });

    set((state) => ({
      cards: state.cards.filter((card) => card.spaceId !== spaceId),
      recentActivity: state.recentActivity.filter((entry) => entry.spaceId !== spaceId),
      spaces: state.spaces.filter((space) => space.id !== spaceId),
      spaceStats: state.spaceStats.filter((entry) => entry.spaceId !== spaceId),
    }));

    const snapshot = await loadReviewSnapshot();
    set(snapshot);
    syncTrayStatus();
  },

  async renameSpace(spaceId, name) {
    const renamedSpace = await getStorage().renameSpace({ id: spaceId, name });

    set((state) => ({
      cards: state.cards.map((card) =>
        card.spaceId === spaceId ? { ...card, spaceName: renamedSpace.name } : card,
      ),
      recentActivity: state.recentActivity.map((entry) =>
        entry.spaceId === spaceId ? { ...entry, spaceName: renamedSpace.name } : entry,
      ),
      spaces: sortSpaces(
        state.spaces.map((space) => (space.id === renamedSpace.id ? renamedSpace : space)),
      ),
    }));

    return renamedSpace;
  },

  async saveApprovedAiCards(input) {
    set({ isMutatingCards: true });

    try {
      await Promise.all(
        input.cards.map((card) =>
          getStorage().createCard({
            ...card,
            source: "ai",
            spaceId: input.spaceId,
          }),
        ),
      );

      const snapshot = await loadFullSnapshot();
      set(snapshot);
      syncTrayStatus();
    } finally {
      set({ isMutatingCards: false });
    }
  },

  async resetAllData() {
    await resetAllAppData();
    const snapshot = await loadFullSnapshot();
    set(snapshot);
    syncTrayStatus();
  },

  async saveStudySettings(newCardsLimit) {
    set({ isSavingStudySettings: true });

    try {
      const studySettings = await getStorage().saveStudySettings(newCardsLimit);
      set({ studySettings });
    } finally {
      set({ isSavingStudySettings: false });
    }
  },
}));
