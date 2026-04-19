import { type FormEvent, useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { AiGenerateScreen, AiGenerateTitlebar } from "./components/ai-generate";
import { type AppTab, AppTitlebar, CommandPalette } from "./components/app-shell";
import { CardsScreen } from "./components/cards";
import { Dashboard, NewSpaceDialog, RulersOverlay } from "./components/dashboard";
import { ImportScreen } from "./components/import";
import { OnboardingScreen } from "./components/onboarding";
import { SettingsScreen } from "./components/settings";
import { SpaceDetailsScreen } from "./components/space-details";
import { type StudyScope, StudyScreen } from "./components/study";
import { useAppStore } from "./lib/app-store";
import {
  dismissDailyCheckIn,
  getDismissedDailyCheckInDay,
  getTodayDayKey,
} from "./lib/daily-checkin";
import {
  buildActivity,
  buildSpaceCards,
  buildStats,
  buildStreakCells,
  buildStudySummary,
  shouldShowDailyCheckInPrompt,
} from "./lib/derived";
import { dismissOnboarding, hasDismissedOnboarding, resetOnboarding } from "./lib/onboarding";
import { isTauriRuntime } from "./lib/runtime";
import {
  FALLBACK_ACTIVITY,
  FALLBACK_SPACES,
  FALLBACK_STATS,
  FALLBACK_STUDY_SUMMARY,
} from "./lib/seed-data";
import { computeNewCardsBudget } from "./lib/study-settings";

const APP_TABS: AppTab[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "cards", label: "All Cards" },
  { id: "import", label: "Import" },
  { id: "settings", label: "Settings" },
];

type StudySessionState =
  | { scope: "global"; startedAt: number }
  | { scope: "space"; spaceId: string; startedAt: number };

type AiGenerateSessionState =
  | { scope: "global"; initialSpaceId: string | null }
  | { scope: "space"; spaceId: string };

type ImportSessionState = { scope: "space"; spaceId: string };

export default function App() {
  const {
    bootstrapError,
    cards,
    createCard,
    createSpace,
    dashboardStats,
    deleteCard,
    deleteSpace,
    initialize,
    isBootstrapping,
    isMutatingCards,
    isSavingStudySettings,
    recentActivity,
    refreshAll,
    refreshStudySettings,
    resetAllData,
    reviewCard,
    saveApprovedAiCards,
    saveStudySettings,
    spaces,
    spaceStats,
    studySettings,
    suspendCard,
    updateCard,
  } = useAppStore(
    useShallow((state) => ({
      bootstrapError: state.bootstrapError,
      cards: state.cards,
      createCard: state.createCard,
      createSpace: state.createSpace,
      dashboardStats: state.dashboardStats,
      deleteCard: state.deleteCard,
      deleteSpace: state.deleteSpace,
      initialize: state.initialize,
      isBootstrapping: state.isBootstrapping,
      isMutatingCards: state.isMutatingCards,
      isSavingStudySettings: state.isSavingStudySettings,
      recentActivity: state.recentActivity,
      refreshAll: state.refreshAll,
      refreshStudySettings: state.refreshStudySettings,
      resetAllData: state.resetAllData,
      reviewCard: state.reviewCard,
      saveApprovedAiCards: state.saveApprovedAiCards,
      saveStudySettings: state.saveStudySettings,
      spaces: state.spaces,
      spaceStats: state.spaceStats,
      studySettings: state.studySettings,
      suspendCard: state.suspendCard,
      updateCard: state.updateCard,
    })),
  );
  const [activeTab, setActiveTab] = useState<AppTab["id"]>("dashboard");
  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState(false);
  const [dismissedDailyCheckInDay, setDismissedDailyCheckInDay] = useState<string | null>(() =>
    getDismissedDailyCheckInDay(),
  );
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [studySession, setStudySession] = useState<StudySessionState | null>(null);
  const [aiGenerateSession, setAiGenerateSession] = useState<AiGenerateSessionState | null>(null);
  const [showSettingsFromAi, setShowSettingsFromAi] = useState(false);
  const [importSession, setImportSession] = useState<ImportSessionState | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceError, setNewSpaceError] = useState<string | null>(null);
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  useEffect(() => {
    setIsOnboardingDismissed(hasDismissedOnboarding());
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let unlisten: (() => void) | null = null;

    void import("@tauri-apps/api/event").then(({ listen }) =>
      listen("developer://reset-onboarding", () => {
        resetOnboarding();
        window.scrollTo({ top: 0, behavior: "auto" });
        setIsOnboardingDismissed(false);
        setActiveTab("dashboard");
        setSelectedSpaceId(null);
        setStudySession(null);
        setAiGenerateSession(null);
        setImportSession(null);
        setIsCreateDialogOpen(false);
      }).then((dispose) => {
        unlisten = dispose;
      }),
    );

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let unlisten: (() => void) | null = null;

    void import("@tauri-apps/api/event").then(({ listen }) =>
      listen("tray://study-now", () => {
        setStudySession({ scope: "global", startedAt: Date.now() });
      }).then((dispose) => {
        unlisten = dispose;
      }),
    );

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const hasRealSpaces = spaces.length > 0;
  const now = Date.now();
  const todayDayKey = getTodayDayKey(now);
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
  const selectedSpaceStats =
    selectedSpaceId !== null ? (spaceStatsById.get(selectedSpaceId) ?? null) : null;
  const selectedSpace =
    selectedSpaceId !== null
      ? (spaces.find((space) => space.id === selectedSpaceId) ?? null)
      : null;
  const studySpace =
    studySession?.scope === "space"
      ? (spaces.find((space) => space.id === studySession.spaceId) ?? null)
      : null;
  const aiGenerateSpace =
    aiGenerateSession?.scope === "space"
      ? (spaces.find((space) => space.id === aiGenerateSession.spaceId) ?? null)
      : null;
  const importSpace =
    importSession?.scope === "space"
      ? (spaces.find((space) => space.id === importSession.spaceId) ?? null)
      : null;
  const studyCards =
    studySession?.scope === "space"
      ? cards.filter((card) => card.spaceId === studySession.spaceId)
      : cards;
  const newCardsBudget = computeNewCardsBudget(
    studySettings.newCardsLimit,
    studySettings.newCardsToday,
  );
  const shouldShowOnboarding =
    !selectedSpace &&
    !studySession &&
    !aiGenerateSession &&
    !importSession &&
    !isOnboardingDismissed;

  async function handleCreateSpaceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNewSpaceError(null);
    setIsCreatingSpace(true);

    try {
      await createSpace(newSpaceName);
      setNewSpaceName("");
      setIsCreateDialogOpen(false);
    } catch (error: unknown) {
      setNewSpaceError(error instanceof Error ? error.message : "Failed to create space.");
    } finally {
      setIsCreatingSpace(false);
    }
  }

  function handleOpenCreateDialog() {
    setNewSpaceError(null);
    setNewSpaceName("");
    setIsCreateDialogOpen(true);
  }

  function handleCloseCreateDialog() {
    if (isCreatingSpace) {
      return;
    }

    setIsCreateDialogOpen(false);
    setNewSpaceError(null);
  }

  function handleOpenSpace(spaceId: string) {
    window.scrollTo({ top: 0, behavior: "auto" });
    setSelectedSpaceId(spaceId);
  }

  function handleCloseSpaceDetails() {
    setSelectedSpaceId(null);
  }

  async function handleDeleteSpace(spaceId: string) {
    await deleteSpace(spaceId);
    setSelectedSpaceId(null);
  }

  async function startStudySession(nextSession: StudySessionState) {
    try {
      await refreshStudySettings();
    } catch (error: unknown) {
      console.error("Failed to refresh study settings before session start.", error);
    }

    setStudySession(nextSession);
  }

  function handleStartGlobalStudy() {
    if (dashboardStats?.dueToday) {
      setDismissedDailyCheckInDay(dismissDailyCheckIn(todayDayKey));
    }
    void startStudySession({ scope: "global", startedAt: Date.now() });
  }

  function handleStartSpaceStudy(spaceId: string) {
    void startStudySession({ scope: "space", spaceId, startedAt: Date.now() });
  }

  function handleStudySecondaryAction() {
    const targetSpace =
      [...spaces].sort(
        (left, right) =>
          right.dueTodayCount - left.dueTodayCount || right.updatedAt - left.updatedAt,
      )[0] ?? null;

    if (!targetSpace) {
      return;
    }

    handleOpenSpace(targetSpace.id);
  }

  function handleCloseStudySession() {
    setStudySession(null);
  }

  function handleOpenGlobalAiGenerate(initialSpaceId: string | null = null) {
    window.scrollTo({ top: 0, behavior: "auto" });
    setAiGenerateSession({ initialSpaceId, scope: "global" });
  }

  function handleOpenSpaceAiGenerate(spaceId: string) {
    window.scrollTo({ top: 0, behavior: "auto" });
    setAiGenerateSession({ scope: "space", spaceId });
  }

  function handleCloseAiGenerate() {
    setAiGenerateSession(null);
    setShowSettingsFromAi(false);
  }

  function handleOpenSpaceImport(spaceId: string) {
    window.scrollTo({ top: 0, behavior: "auto" });
    setImportSession({ scope: "space", spaceId });
  }

  function handleCloseImport() {
    setImportSession(null);
  }

  function handleOpenSettingsFromAi() {
    setShowSettingsFromAi(true);
  }

  async function handleSaveApprovedAiCards(input: {
    cards: Array<{ back: string; front: string; tags: string[] }>;
    spaceId: string;
  }) {
    await saveApprovedAiCards(input);
    setAiGenerateSession(null);
    setShowSettingsFromAi(false);
    setSelectedSpaceId(input.spaceId);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  async function handleResetAllData() {
    await resetAllData();
    setSelectedSpaceId(null);
    setStudySession(null);
    setAiGenerateSession(null);
    setImportSession(null);
    setDismissedDailyCheckInDay(null);
  }

  function handleDismissOnboarding() {
    dismissOnboarding();
    setIsOnboardingDismissed(true);
  }

  function handleOnboardingCreateSpace() {
    handleDismissOnboarding();
    handleOpenCreateDialog();
  }

  function handleOnboardingImport() {
    handleDismissOnboarding();
    setActiveTab("import");
  }

  function handleOnboardingGenerateWithAi() {
    handleDismissOnboarding();
    handleOpenGlobalAiGenerate(spaces[0]?.id ?? null);
  }

  function handleOnboardingSkip() {
    handleDismissOnboarding();
    setActiveTab("dashboard");
  }

  function handleOnboardingOpenSettings() {
    handleDismissOnboarding();
    setActiveTab("settings");
  }

  return (
    <main className="app-shell">
      {bootstrapError ? (
        <section className="status-panel" role="alert">
          <strong>Bootstrap failed</strong>
          <p>{bootstrapError}</p>
        </section>
      ) : isBootstrapping ? (
        <section className="status-panel" aria-live="polite">
          <strong>Loading</strong>
          <p>Preparing the app shell.</p>
        </section>
      ) : (
        <>
          {studySession ? null : <RulersOverlay />}

          <div className="dashboard-shell">
            {shouldShowOnboarding ? (
              <OnboardingScreen
                onCreateSpace={handleOnboardingCreateSpace}
                onGenerateWithAi={handleOnboardingGenerateWithAi}
                onImport={handleOnboardingImport}
                onOpenSettings={handleOnboardingOpenSettings}
                onSkip={handleOnboardingSkip}
              />
            ) : aiGenerateSession ? (
              <>
                {/* Always keep AiGenerateScreen mounted so its internal state survives
                    the detour to Settings. Hidden via display:none while settings is shown. */}
                <div style={showSettingsFromAi ? { display: "none" } : undefined}>
                  <AiGenerateScreen
                    backLabel={
                      aiGenerateSession.scope === "space"
                        ? (aiGenerateSpace?.name ?? "Space")
                        : "Dashboard"
                    }
                    initialSpaceId={
                      aiGenerateSession.scope === "space"
                        ? aiGenerateSession.spaceId
                        : aiGenerateSession.initialSpaceId
                    }
                    onBack={handleCloseAiGenerate}
                    onCreateSpace={createSpace}
                    onOpenSettings={handleOpenSettingsFromAi}
                    onSaveApprovedCards={handleSaveApprovedAiCards}
                    spaces={spaces}
                  />
                </div>
                {showSettingsFromAi ? (
                  <>
                    <AiGenerateTitlebar
                      backLabel="AI Generate"
                      onBack={() => setShowSettingsFromAi(false)}
                    />
                    <SettingsScreen
                      cardsCount={cards.length}
                      isSavingStudySettings={isSavingStudySettings}
                      onResetAllData={handleResetAllData}
                      onSaveStudySettings={saveStudySettings}
                      spacesCount={spaces.length}
                      studySettings={studySettings}
                    />
                  </>
                ) : null}
              </>
            ) : importSession ? (
              <ImportScreen
                backLabel={importSpace?.name ?? "Space"}
                onBack={handleCloseImport}
                onImportComplete={refreshAll}
                onOpenCards={() => {
                  setImportSession(null);
                  if (importSpace) {
                    setSelectedSpaceId(importSpace.id);
                  }
                }}
                onStudyNow={() => {
                  if (!importSpace) {
                    return;
                  }

                  setImportSession(null);
                  void startStudySession({
                    scope: "space",
                    spaceId: importSpace.id,
                    startedAt: Date.now(),
                  });
                }}
                targetSpaceId={importSpace?.id ?? null}
                targetSpaceName={importSpace?.name ?? null}
              />
            ) : studySession ? (
              <StudyScreen
                cards={studyCards}
                newCardsBudget={newCardsBudget}
                onBack={handleCloseStudySession}
                onDeleteCard={deleteCard}
                onReviewCard={reviewCard}
                onSuspendCard={suspendCard}
                sessionKey={studySession.startedAt}
                scope={studySession.scope as StudyScope}
                scopeLabel={
                  studySession.scope === "space" ? (studySpace?.name ?? "Space") : "All spaces"
                }
                space={studySpace}
              />
            ) : selectedSpace ? (
              <SpaceDetailsScreen
                cards={cards}
                isMutating={isMutatingCards}
                onBack={handleCloseSpaceDetails}
                onCreateCard={createCard}
                onDeleteCard={deleteCard}
                onDeleteSpace={() => handleDeleteSpace(selectedSpace.id)}
                onOpenAiGenerate={() => handleOpenSpaceAiGenerate(selectedSpace.id)}
                onOpenImport={() => handleOpenSpaceImport(selectedSpace.id)}
                onStartStudy={() => handleStartSpaceStudy(selectedSpace.id)}
                onSuspendCard={suspendCard}
                stats={selectedSpaceStats}
                onUpdateCard={updateCard}
                space={selectedSpace}
              />
            ) : (
              <>
                <AppTitlebar
                  activeTab={activeTab}
                  globalStreak={activeTab === "dashboard" ? globalStreak : null}
                  onOpenCreateDialog={handleOpenCreateDialog}
                  onOpenPalette={() => setIsPaletteOpen(true)}
                  onSelectTab={setActiveTab}
                  tabs={APP_TABS}
                />

                {activeTab === "dashboard" ? (
                  <Dashboard
                    activity={activity}
                    isDailyCheckInActive={isDailyCheckInActive}
                    onOpenCreateDialog={handleOpenCreateDialog}
                    onOpenSpace={handleOpenSpace}
                    onStudyPrimaryAction={
                      hasRealSpaces ? handleStartGlobalStudy : handleOpenCreateDialog
                    }
                    onStudySecondaryAction={hasRealSpaces ? handleStudySecondaryAction : undefined}
                    spaces={spaceCards}
                    stats={stats}
                    streakCells={streakCells}
                    streakCount={globalStreak}
                    studySummary={studySummary}
                  />
                ) : activeTab === "cards" ? (
                  <CardsScreen
                    cards={cards}
                    isMutating={isMutatingCards}
                    onCreateCard={createCard}
                    onDeleteCard={deleteCard}
                    onOpenCreateDialog={handleOpenCreateDialog}
                    onSuspendCard={suspendCard}
                    onUpdateCard={updateCard}
                    spaces={spaces}
                  />
                ) : activeTab === "import" ? (
                  <ImportScreen
                    onImportComplete={refreshAll}
                    onOpenCards={() => setActiveTab("cards")}
                    onStudyNow={handleStartGlobalStudy}
                    spaces={spaces}
                  />
                ) : activeTab === "settings" ? (
                  <SettingsScreen
                    cardsCount={cards.length}
                    isSavingStudySettings={isSavingStudySettings}
                    onResetAllData={handleResetAllData}
                    onSaveStudySettings={saveStudySettings}
                    spacesCount={spaces.length}
                    studySettings={studySettings}
                  />
                ) : (
                  <div className="page cards-page" />
                )}
              </>
            )}
          </div>

          {isCreateDialogOpen ? (
            <NewSpaceDialog
              error={newSpaceError}
              isSubmitting={isCreatingSpace}
              onChange={setNewSpaceName}
              onClose={handleCloseCreateDialog}
              onSubmit={handleCreateSpaceSubmit}
              value={newSpaceName}
            />
          ) : null}

          {isPaletteOpen ? (
            <CommandPalette
              cards={cards}
              onClose={() => setIsPaletteOpen(false)}
              onOpenAiGenerate={handleOpenGlobalAiGenerate}
              onOpenCreateDialog={handleOpenCreateDialog}
              onOpenImport={() => setActiveTab("import")}
              onOpenSettings={() => setActiveTab("settings")}
              onOpenSpace={handleOpenSpace}
              onSelectTab={setActiveTab}
              onStartGlobalStudy={handleStartGlobalStudy}
              spaces={spaces}
            />
          ) : null}
        </>
      )}
    </main>
  );
}
