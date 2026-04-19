import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useLocation,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { createContext, type FormEvent, useContext, useEffect, useState } from "react";
import { AiGenerateScreen, AiGenerateTitlebar } from "./components/ai-generate";
import { AppTitlebar, CommandPalette, NotificationsViewport } from "./components/app-shell";
import { CardsScreen } from "./components/cards";
import { Dashboard, NewSpaceDialog, RulersOverlay } from "./components/dashboard";
import { ScreenErrorBoundary } from "./components/ErrorBoundary";
import { ImportScreen } from "./components/import";
import { OnboardingScreen } from "./components/onboarding";
import { SettingsScreen } from "./components/settings";
import { SpaceDetailsScreen } from "./components/space-details";
import { StudyScreen } from "./components/study";
import { listRecentActivity } from "./lib/activity";
import { loadBootstrapState } from "./lib/bootstrap";
import {
  createCard,
  deleteCard,
  listCards,
  reviewCard,
  suspendCard,
  updateCard,
} from "./lib/cards";
import {
  dismissDailyCheckIn,
  getDismissedDailyCheckInDay,
  getTodayDayKey,
} from "./lib/daily-checkin";
import { resetAllData } from "./lib/data-actions";
import {
  buildActivity,
  buildSpaceCards,
  buildStats,
  buildStreakCells,
  buildStudySummary,
  shouldShowDailyCheckInPrompt,
} from "./lib/derived";
import { toAppError } from "./lib/errors";
import { log } from "./lib/log";
import { notifyError, notifySuccess } from "./lib/notifications";
import { dismissOnboarding, hasDismissedOnboarding, resetOnboarding } from "./lib/onboarding";
import {
  appQueryKeys,
  invalidateAfterCardDeletion,
  invalidateAfterCardMutation,
  invalidateAfterReview,
  invalidateAllAppData,
} from "./lib/query";
import { isTauriRuntime } from "./lib/runtime";
import {
  FALLBACK_ACTIVITY,
  FALLBACK_SPACES,
  FALLBACK_STATS,
  FALLBACK_STUDY_SUMMARY,
} from "./lib/seed-data";
import { createSpace, deleteSpace, listSpaces } from "./lib/spaces";
import { getDashboardStats, listSpaceStats } from "./lib/stats";
import { computeNewCardsBudget, getStudySettings, saveStudySettings } from "./lib/study-settings";

const APP_TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "cards", label: "All Cards" },
  { id: "import", label: "Import" },
  { id: "settings", label: "Settings" },
] as const;

type ShellActions = {
  openCreateDialog: () => void;
};

const ShellActionsContext = createContext<ShellActions | null>(null);

function useShellActions() {
  const context = useContext(ShellActionsContext);

  if (!context) {
    throw new Error("Shell actions are unavailable outside the router shell.");
  }

  return context;
}

function StatusPanel({ message, title }: { message: string; title: string }) {
  return (
    <section className="status-panel" aria-live="polite">
      <strong>{title}</strong>
      <p>{message}</p>
    </section>
  );
}

function useCoreQuery<T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) {
  return useQuery({
    queryKey,
    queryFn,
  });
}

function useCardsQuery() {
  return useCoreQuery(appQueryKeys.cards, () => listCards());
}

function useSpacesQuery() {
  return useCoreQuery(appQueryKeys.spaces, () => listSpaces());
}

function useDashboardStatsQuery() {
  return useCoreQuery(appQueryKeys.dashboardStats, () => getDashboardStats());
}

function useRecentActivityQuery() {
  return useCoreQuery(appQueryKeys.recentActivity, () => listRecentActivity());
}

function useSpaceStatsQuery() {
  return useCoreQuery(appQueryKeys.spaceStats, () => listSpaceStats());
}

function useStudySettingsQuery() {
  return useCoreQuery(appQueryKeys.studySettings, () => getStudySettings());
}

function RootShell() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const bootstrapQuery = useCoreQuery(appQueryKeys.bootstrap, () => loadBootstrapState());
  const spacesQuery = useSpacesQuery();
  const cardsQuery = useCardsQuery();
  const dashboardStatsQuery = useDashboardStatsQuery();
  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceError, setNewSpaceError] = useState<string | null>(null);

  const spaces = spacesQuery.data ?? [];
  const cards = cardsQuery.data ?? [];
  const globalStreak = dashboardStatsQuery.data?.globalStreak ?? null;
  const mainTab =
    location.pathname === "/cards"
      ? "cards"
      : location.pathname === "/import"
        ? "import"
        : location.pathname === "/settings"
          ? "settings"
          : location.pathname === "/"
            ? "dashboard"
            : null;

  useEffect(() => {
    setIsOnboardingDismissed(hasDismissedOnboarding());
  }, []);

  useEffect(() => {
    if (bootstrapQuery.isPending || spacesQuery.isPending) {
      return;
    }

    if (!isOnboardingDismissed && spaces.length === 0 && location.pathname === "/") {
      void navigate({ to: "/onboarding" });
      return;
    }

    if ((isOnboardingDismissed || spaces.length > 0) && location.pathname === "/onboarding") {
      void navigate({ to: "/" });
    }
  }, [
    bootstrapQuery.isPending,
    isOnboardingDismissed,
    location.pathname,
    navigate,
    spaces.length,
    spacesQuery.isPending,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setIsPaletteOpen((currentValue) => !currentValue);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const error = toAppError(event.reason, "Unhandled async failure.");
      log.error("Unhandled promise rejection", {
        code: error.code,
        message: error.message,
        severity: error.severity,
      });
      notifyError(error, "Unexpected async failure");
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let disposeReset: (() => void) | undefined;
    let disposeStudy: (() => void) | undefined;

    void import("@tauri-apps/api/event").then(({ listen }) => {
      void listen("developer://reset-onboarding", () => {
        resetOnboarding();
        setIsOnboardingDismissed(false);
        setIsCreateDialogOpen(false);
        setIsPaletteOpen(false);
        void navigate({ to: "/onboarding" });
      }).then((dispose) => {
        disposeReset = dispose;
      });

      void listen("tray://study-now", () => {
        void navigate({ to: "/study" });
      }).then((dispose) => {
        disposeStudy = dispose;
      });
    });

    return () => {
      disposeReset?.();
      disposeStudy?.();
    };
  }, [navigate]);

  const createSpaceMutation = useMutation({
    mutationFn: async (name: string) => createSpace({ name }),
    async onError(error) {
      const appError = toAppError(error, "Failed to create space.");
      setNewSpaceError(appError.message);
      notifyError(appError, "Space creation failed");
    },
    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: appQueryKeys.spaces }),
        queryClient.invalidateQueries({ queryKey: appQueryKeys.dashboardStats }),
      ]);
      notifySuccess("Space created");
      setIsCreateDialogOpen(false);
      setNewSpaceName("");
    },
    onSettled() {
      setIsCreatingSpace(false);
    },
  });

  async function handleCreateSpaceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNewSpaceError(null);
    setIsCreatingSpace(true);
    await createSpaceMutation.mutateAsync(newSpaceName);
  }

  function handleDismissOnboarding() {
    dismissOnboarding();
    setIsOnboardingDismissed(true);
  }

  if (bootstrapQuery.error) {
    return (
      <StatusPanel message={toAppError(bootstrapQuery.error).message} title="Bootstrap failed" />
    );
  }

  if (bootstrapQuery.isPending) {
    return <StatusPanel message="Preparing the app shell." title="Loading" />;
  }

  return (
    <ShellActionsContext.Provider
      value={{
        openCreateDialog() {
          setNewSpaceError(null);
          setNewSpaceName("");
          setIsCreateDialogOpen(true);
        },
      }}
    >
      <main className="app-shell">
        {location.pathname.startsWith("/study") ? null : <RulersOverlay />}

        <div className="dashboard-shell">
          {mainTab ? (
            <AppTitlebar
              activeTab={mainTab}
              globalStreak={mainTab === "dashboard" ? globalStreak : null}
              onOpenCreateDialog={() => setIsCreateDialogOpen(true)}
              onOpenPalette={() => setIsPaletteOpen(true)}
              onSelectTab={(tabId) => {
                if (tabId === "dashboard") {
                  void navigate({ to: "/" });
                } else {
                  void navigate({ to: `/${tabId}` });
                }
              }}
              tabs={[...APP_TABS]}
            />
          ) : null}

          <Outlet />
        </div>

        {location.pathname === "/onboarding" ? (
          <OnboardingScreen
            onCreateSpace={() => {
              handleDismissOnboarding();
              setIsCreateDialogOpen(true);
            }}
            onGenerateWithAi={() => {
              handleDismissOnboarding();
              void navigate({ to: "/generate" });
            }}
            onImport={() => {
              handleDismissOnboarding();
              void navigate({ to: "/import" });
            }}
            onOpenSettings={() => {
              handleDismissOnboarding();
              void navigate({ to: "/settings" });
            }}
            onSkip={() => {
              handleDismissOnboarding();
              void navigate({ to: "/" });
            }}
          />
        ) : null}

        {isCreateDialogOpen ? (
          <NewSpaceDialog
            error={newSpaceError}
            isSubmitting={isCreatingSpace}
            onChange={setNewSpaceName}
            onClose={() => setIsCreateDialogOpen(false)}
            onSubmit={handleCreateSpaceSubmit}
            value={newSpaceName}
          />
        ) : null}

        {isPaletteOpen ? (
          <CommandPalette
            cards={cards}
            onClose={() => setIsPaletteOpen(false)}
            onOpenAiGenerate={() => void navigate({ to: "/generate" })}
            onOpenCreateDialog={() => {
              setIsPaletteOpen(false);
              setIsCreateDialogOpen(true);
            }}
            onOpenImport={() => void navigate({ to: "/import" })}
            onOpenSettings={() => void navigate({ to: "/settings" })}
            onOpenSpace={(spaceId) =>
              void navigate({ to: "/spaces/$spaceId", params: { spaceId } })
            }
            onSelectTab={(tabId) => {
              if (tabId === "dashboard") {
                void navigate({ to: "/" });
              } else {
                void navigate({ to: `/${tabId}` });
              }
            }}
            onStartGlobalStudy={() => void navigate({ to: "/study" })}
            spaces={spaces}
          />
        ) : null}

        <NotificationsViewport />
      </main>
    </ShellActionsContext.Provider>
  );
}

function DashboardPage() {
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

function CardsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { openCreateDialog } = useShellActions();
  const cards = useCardsQuery().data ?? [];
  const spaces = useSpacesQuery().data ?? [];
  const createCardMutation = useMutation({
    mutationFn: createCard,
    onSuccess: async () => {
      await invalidateAfterCardMutation(queryClient);
      notifySuccess("Card saved");
    },
    onError(error) {
      notifyError(toAppError(error, "Failed to save card."), "Card save failed");
    },
  });
  const updateCardMutation = useMutation({
    mutationFn: updateCard,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: appQueryKeys.cards }),
        queryClient.invalidateQueries({ queryKey: appQueryKeys.spaces }),
      ]);
      notifySuccess("Card updated");
    },
    onError(error) {
      notifyError(toAppError(error, "Failed to update card."), "Card update failed");
    },
  });
  const deleteCardMutation = useMutation({
    mutationFn: deleteCard,
    onSuccess: async () => {
      await invalidateAfterCardDeletion(queryClient);
      notifySuccess("Card deleted");
    },
    onError(error) {
      notifyError(toAppError(error, "Failed to delete card."), "Card deletion failed");
    },
  });
  const suspendCardMutation = useMutation({
    mutationFn: suspendCard,
    onSuccess: async () => {
      await invalidateAfterCardDeletion(queryClient);
    },
  });

  return (
    <ScreenErrorBoundary
      onReset={() => void navigate({ to: "/" })}
      screen="cards"
      title="Cards unavailable"
    >
      <CardsScreen
        cards={cards}
        isMutating={
          createCardMutation.isPending ||
          updateCardMutation.isPending ||
          deleteCardMutation.isPending ||
          suspendCardMutation.isPending
        }
        onCreateCard={async (input) => {
          await createCardMutation.mutateAsync(input);
        }}
        onDeleteCard={async (input) => {
          await deleteCardMutation.mutateAsync(input);
        }}
        onOpenCreateDialog={openCreateDialog}
        onSuspendCard={(input) => suspendCardMutation.mutateAsync(input)}
        onUpdateCard={async (input) => {
          await updateCardMutation.mutateAsync(input);
        }}
        spaces={spaces}
      />
    </ScreenErrorBoundary>
  );
}

function SettingsPage({ fromAi = false, onBack }: { fromAi?: boolean; onBack?: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const cards = useCardsQuery().data ?? [];
  const spaces = useSpacesQuery().data ?? [];
  const studySettings = useStudySettingsQuery().data ?? { newCardsLimit: null, newCardsToday: 0 };
  const saveStudySettingsMutation = useMutation({
    mutationFn: saveStudySettings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: appQueryKeys.studySettings });
      notifySuccess("Study settings saved");
    },
    onError(error) {
      notifyError(toAppError(error, "Failed to save study settings."), "Settings save failed");
    },
  });
  const resetMutation = useMutation({
    mutationFn: resetAllData,
    onSuccess: async () => {
      await invalidateAllAppData(queryClient);
      notifySuccess("All local data was reset");
      void navigate({ to: "/onboarding" });
    },
    onError(error) {
      notifyError(toAppError(error, "Failed to reset local data."), "Reset failed");
    },
  });

  const content = (
    <SettingsScreen
      cardsCount={cards.length}
      isSavingStudySettings={saveStudySettingsMutation.isPending}
      onResetAllData={async () => {
        await resetMutation.mutateAsync();
      }}
      onSaveStudySettings={async (newCardsLimit) => {
        await saveStudySettingsMutation.mutateAsync(newCardsLimit);
      }}
      spacesCount={spaces.length}
      studySettings={studySettings}
    />
  );

  if (fromAi && onBack) {
    return (
      <>
        <AiGenerateTitlebar backLabel="AI Generate" onBack={onBack} />
        {content}
      </>
    );
  }

  return (
    <ScreenErrorBoundary
      onReset={() => void navigate({ to: "/" })}
      screen="settings"
      title="Settings unavailable"
    >
      {content}
    </ScreenErrorBoundary>
  );
}

function ImportPage({ targetSpaceId }: { targetSpaceId?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const spaces = useSpacesQuery().data ?? [];
  const targetSpace = targetSpaceId
    ? (spaces.find((space) => space.id === targetSpaceId) ?? null)
    : null;

  return (
    <ScreenErrorBoundary
      onReset={() => void navigate({ to: "/" })}
      screen="import"
      title="Import unavailable"
    >
      <ImportScreen
        backLabel={targetSpace?.name ?? "Space"}
        onBack={
          targetSpace
            ? () => void navigate({ to: "/spaces/$spaceId", params: { spaceId: targetSpace.id } })
            : undefined
        }
        onImportComplete={async () => {
          await invalidateAllAppData(queryClient);
          notifySuccess("Import complete");
        }}
        onOpenCards={() =>
          targetSpace
            ? void navigate({ to: "/spaces/$spaceId", params: { spaceId: targetSpace.id } })
            : void navigate({ to: "/cards" })
        }
        onStudyNow={() =>
          targetSpace
            ? void navigate({ to: "/spaces/$spaceId/study", params: { spaceId: targetSpace.id } })
            : void navigate({ to: "/study" })
        }
        spaces={targetSpace ? undefined : spaces}
        targetSpaceId={targetSpace?.id ?? null}
        targetSpaceName={targetSpace?.name ?? null}
      />
    </ScreenErrorBoundary>
  );
}

function SpaceDetailsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { spaceId } = useParams({ from: "/spaces/$spaceId" });
  const cards = useCardsQuery().data ?? [];
  const spaces = useSpacesQuery().data ?? [];
  const spaceStats = useSpaceStatsQuery().data ?? [];
  const space = spaces.find((entry) => entry.id === spaceId) ?? null;
  const stats = spaceStats.find((entry) => entry.spaceId === spaceId) ?? null;
  const createCardMutation = useMutation({
    mutationFn: createCard,
    onSuccess: async () => {
      await invalidateAfterCardMutation(queryClient);
      notifySuccess("Card saved");
    },
  });
  const updateCardMutation = useMutation({
    mutationFn: updateCard,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: appQueryKeys.cards }),
        queryClient.invalidateQueries({ queryKey: appQueryKeys.spaces }),
      ]);
      notifySuccess("Card updated");
    },
  });
  const deleteCardMutation = useMutation({
    mutationFn: deleteCard,
    onSuccess: async () => {
      await invalidateAfterCardDeletion(queryClient);
      notifySuccess("Card deleted");
    },
  });
  const suspendCardMutation = useMutation({
    mutationFn: suspendCard,
    onSuccess: async () => {
      await invalidateAfterCardDeletion(queryClient);
    },
  });
  const deleteSpaceMutation = useMutation({
    mutationFn: async () => deleteSpace({ id: spaceId }),
    onSuccess: async () => {
      await invalidateAllAppData(queryClient);
      notifySuccess("Space deleted");
      void navigate({ to: "/" });
    },
  });

  if (!space) {
    return <StatusPanel message="That space no longer exists." title="Space not found" />;
  }

  return (
    <ScreenErrorBoundary
      onReset={() => void navigate({ to: "/" })}
      screen="space"
      title="Space unavailable"
    >
      <SpaceDetailsScreen
        cards={cards}
        isMutating={
          createCardMutation.isPending ||
          updateCardMutation.isPending ||
          deleteCardMutation.isPending ||
          suspendCardMutation.isPending
        }
        onBack={() => void navigate({ to: "/" })}
        onCreateCard={async (input) => {
          await createCardMutation.mutateAsync(input);
        }}
        onDeleteCard={async (input) => {
          await deleteCardMutation.mutateAsync(input);
        }}
        onDeleteSpace={() => deleteSpaceMutation.mutateAsync()}
        onOpenAiGenerate={() =>
          void navigate({ to: "/spaces/$spaceId/generate", params: { spaceId } })
        }
        onOpenImport={() => void navigate({ to: "/spaces/$spaceId/import", params: { spaceId } })}
        onStartStudy={() => void navigate({ to: "/spaces/$spaceId/study", params: { spaceId } })}
        onSuspendCard={(input) => suspendCardMutation.mutateAsync(input)}
        onUpdateCard={async (input) => {
          await updateCardMutation.mutateAsync(input);
        }}
        space={space}
        stats={stats}
      />
    </ScreenErrorBoundary>
  );
}

function StudyPage({ targetSpaceId }: { targetSpaceId?: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [sessionKey] = useState(() => Date.now());
  const cards = useCardsQuery().data ?? [];
  const spaces = useSpacesQuery().data ?? [];
  const studySettings = useStudySettingsQuery().data ?? { newCardsLimit: null, newCardsToday: 0 };
  const targetSpace = targetSpaceId
    ? (spaces.find((space) => space.id === targetSpaceId) ?? null)
    : null;
  const sessionCards = targetSpaceId
    ? cards.filter((card) => card.spaceId === targetSpaceId)
    : cards;
  const reviewMutation = useMutation({
    mutationFn: reviewCard,
    onSuccess: async () => {
      await invalidateAfterReview(queryClient);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteCard,
    onSuccess: async () => {
      await invalidateAfterCardDeletion(queryClient);
    },
  });
  const suspendMutation = useMutation({
    mutationFn: suspendCard,
    onSuccess: async () => {
      await invalidateAfterCardDeletion(queryClient);
    },
  });

  return (
    <ScreenErrorBoundary
      onReset={() =>
        void navigate({
          to: targetSpaceId ? "/spaces/$spaceId" : "/",
          params: targetSpaceId ? { spaceId: targetSpaceId } : (undefined as never),
        })
      }
      screen="study"
      title="Study session unavailable"
    >
      <StudyScreen
        cards={sessionCards}
        newCardsBudget={computeNewCardsBudget(
          studySettings.newCardsLimit,
          studySettings.newCardsToday,
        )}
        onBack={() =>
          targetSpaceId
            ? void navigate({ to: "/spaces/$spaceId", params: { spaceId: targetSpaceId } })
            : void navigate({ to: "/" })
        }
        onDeleteCard={(input) => deleteMutation.mutateAsync(input)}
        onReviewCard={(input) => reviewMutation.mutateAsync(input)}
        onSuspendCard={(input) => suspendMutation.mutateAsync(input)}
        scope={targetSpaceId ? "space" : "global"}
        scopeLabel={targetSpace?.name ?? "All spaces"}
        sessionKey={sessionKey}
        space={targetSpace}
      />
    </ScreenErrorBoundary>
  );
}

function AiGeneratePage({ targetSpaceId }: { targetSpaceId?: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const spaces = useSpacesQuery().data ?? [];
  const targetSpace = targetSpaceId
    ? (spaces.find((space) => space.id === targetSpaceId) ?? null)
    : null;
  const [showSettings, setShowSettings] = useState(false);
  const createSpaceMutation = useMutation({
    mutationFn: async (name: string) => createSpace({ name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: appQueryKeys.spaces });
    },
  });
  const saveApprovedMutation = useMutation({
    mutationFn: async (input: {
      cards: Array<{ back: string; front: string; tags: string[] }>;
      spaceId: string;
    }) => {
      await Promise.all(
        input.cards.map((card) =>
          createCard({
            ...card,
            source: "ai",
            spaceId: input.spaceId,
          }),
        ),
      );
    },
    onSuccess: async (_, variables) => {
      await invalidateAllAppData(queryClient);
      notifySuccess("AI cards saved");
      void navigate({ to: "/spaces/$spaceId", params: { spaceId: variables.spaceId } });
    },
  });
  if (showSettings) {
    return (
      <SettingsPage
        fromAi
        onBack={() => {
          setShowSettings(false);
        }}
      />
    );
  }

  return (
    <ScreenErrorBoundary
      onReset={() =>
        targetSpaceId
          ? void navigate({ to: "/spaces/$spaceId", params: { spaceId: targetSpaceId } })
          : void navigate({ to: "/" })
      }
      screen="ai-generate"
      title="AI generation unavailable"
    >
      <AiGenerateScreen
        backLabel={targetSpace?.name ?? "Dashboard"}
        initialSpaceId={targetSpaceId ?? spaces[0]?.id ?? null}
        onBack={() =>
          targetSpaceId
            ? void navigate({ to: "/spaces/$spaceId", params: { spaceId: targetSpaceId } })
            : void navigate({ to: "/" })
        }
        onCreateSpace={(name) => createSpaceMutation.mutateAsync(name)}
        onOpenSettings={() => {
          setShowSettings(true);
        }}
        onSaveApprovedCards={(input) => saveApprovedMutation.mutateAsync(input)}
        spaces={spaces}
      />
    </ScreenErrorBoundary>
  );
}

const rootRoute = createRootRoute({
  component: RootShell,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/onboarding",
  component: () => null,
});

const cardsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cards",
  component: CardsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: () => <SettingsPage />,
});

const importRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/import",
  component: () => <ImportPage />,
});

const studyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/study",
  component: () => <StudyPage />,
});

const generateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/generate",
  component: () => <AiGeneratePage />,
});

const spaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/spaces/$spaceId",
  component: SpaceDetailsPage,
});

const spaceImportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/spaces/$spaceId/import",
  component: () => {
    const { spaceId } = useParams({ from: "/spaces/$spaceId/import" });
    return <ImportPage targetSpaceId={spaceId} />;
  },
});

const spaceStudyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/spaces/$spaceId/study",
  component: () => {
    const { spaceId } = useParams({ from: "/spaces/$spaceId/study" });
    return <StudyPage targetSpaceId={spaceId} />;
  },
});

const spaceGenerateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/spaces/$spaceId/generate",
  component: () => {
    const { spaceId } = useParams({ from: "/spaces/$spaceId/generate" });
    return <AiGeneratePage targetSpaceId={spaceId} />;
  },
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  onboardingRoute,
  cardsRoute,
  settingsRoute,
  importRoute,
  studyRoute,
  generateRoute,
  spaceRoute,
  spaceImportRoute,
  spaceStudyRoute,
  spaceGenerateRoute,
]);

export const router = createRouter({
  routeTree,
  history: createMemoryHistory({
    initialEntries: ["/"],
  }),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />;
}
