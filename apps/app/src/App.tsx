import { useEffect, useState, type FormEvent } from "react";
import { AppTitlebar, type AppTab } from "./components/app-shell";
import { AiGenerateScreen } from "./components/ai-generate";
import { CardsScreen } from "./components/cards";
import {
  Dashboard,
  NewSpaceDialog,
  RulersOverlay,
  type ActivityItem,
  type SpaceCardData,
  type StatCardData,
  type StreakCellData,
  type StudySummary,
} from "./components/dashboard";
import { ImportScreen } from "./components/import";
import { OnboardingScreen } from "./components/onboarding";
import { SettingsScreen } from "./components/settings";
import { SpaceDetailsScreen } from "./components/space-details";
import { StudyScreen, type StudyScope } from "./components/study";
import { listRecentActivity, type RecentActivityRecord } from "./lib/activity";
import {
  createCard,
  deleteCard,
  listCards,
  reviewCard,
  updateCard,
  type CardRecord,
} from "./lib/cards";
import { loadBootstrapState } from "./lib/bootstrap";
import { resetAllData } from "./lib/data-actions";
import {
  dismissDailyCheckIn,
  getDismissedDailyCheckInDay,
  getTodayDayKey,
} from "./lib/daily-checkin";
import { dismissOnboarding, hasDismissedOnboarding, resetOnboarding } from "./lib/onboarding";
import { isTauriRuntime } from "./lib/runtime";
import { createSpace, listSpaces, type SpaceSummary } from "./lib/spaces";
import {
  getDashboardStats,
  listSpaceStats,
  type DashboardStats as DashboardStatsRecord,
  type SpaceStats as SpaceStatsRecord,
} from "./lib/stats";

const APP_TABS: AppTab[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "cards", label: "All Cards" },
  { id: "import", label: "Import" },
  { id: "settings", label: "Settings" },
];

const FALLBACK_STUDY_SUMMARY: StudySummary = {
  eyebrow: "Ready to study",
  headline: "42 cards due today",
  description:
    "Across 5 spaces. 18 already reviewed — 24 remaining. Most overdue in Machine Learning and World History.",
  breakdown: [
    { label: "Machine Learning", value: 18 },
    { label: "World History", value: 11 },
    { label: "Rust", value: 7 },
    { label: "other", value: 6 },
  ],
  primaryActionLabel: "Study all →",
  secondaryActionLabel: "Per space",
};

const FALLBACK_STATS: StatCardData[] = [
  { label: "Total cards", value: "847", trend: "↑ 23", subtext: "this week" },
  { label: "Studied today", value: "18", unit: "/ 42", subtext: "due remaining" },
  { label: "Retention", value: "87", unit: "%", trend: "↑ 3%", subtext: "vs last month" },
  { label: "Streak", value: "14", unit: "days", subtext: "personal best" },
];

const FALLBACK_SPACES: SpaceCardData[] = [
  {
    id: "machine-learning",
    name: "Machine Learning",
    description:
      "Neural networks, gradient descent, transformers, attention mechanisms, loss functions.",
    streakLabel: "12d",
    meta: [
      { label: "cards", value: "234" },
      { label: "due", value: "18", variant: "due" },
      { label: "retention", value: "91%" },
      { label: "source", value: "ai · 3d ago", variant: "aux" },
    ],
  },
  {
    id: "rust-ownership",
    name: "Rust Ownership",
    description:
      "Borrow checker, lifetimes, move semantics, smart pointers, interior mutability.",
    streakLabel: "14d",
    meta: [
      { label: "cards", value: "89" },
      { label: "due", value: "7", variant: "due" },
      { label: "retention", value: "84%" },
      { label: "source", value: "manual · 2w", variant: "aux" },
    ],
  },
  {
    id: "world-history",
    name: "World History",
    description:
      "Ancient civilizations, revolutions, world wars, Cold War, colonialism, treaties.",
    streakLabel: "8d",
    meta: [
      { label: "cards", value: "312" },
      { label: "due", value: "11", variant: "due" },
      { label: "retention", value: "79%" },
      { label: "source", value: "anki · 1mo", variant: "aux" },
    ],
  },
  {
    id: "music-theory",
    name: "Music Theory",
    description: "Intervals, chord voicings, modes, harmonic analysis, voice leading.",
    meta: [
      { label: "cards", value: "67" },
      { label: "due", value: "4", variant: "due" },
      { label: "retention", value: "92%" },
      { label: "source", value: "ai · 5d ago", variant: "aux" },
    ],
  },
  {
    id: "biochemistry",
    name: "Biochemistry",
    description:
      "Amino acids, enzyme kinetics, metabolic pathways, protein folding, DNA replication.",
    streakLabel: "3d",
    meta: [
      { label: "cards", value: "145" },
      { label: "due", value: "2", variant: "due" },
      { label: "retention", value: "88%" },
      { label: "source", value: "anki · 2w", variant: "aux" },
    ],
  },
];

const FALLBACK_ACTIVITY: ActivityItem[] = [
  {
    id: "fallback-1",
    timeLabel: "2m ago",
    prefix: "Studied ",
    highlight: "18 cards",
    suffix: " in ML",
    typeLabel: "study",
  },
  {
    id: "fallback-2",
    timeLabel: "1h ago",
    prefix: "Generated ",
    highlight: "15 cards",
    suffix: " — architectures",
    typeLabel: "ai gen",
  },
  {
    id: "fallback-3",
    timeLabel: "3h ago",
    prefix: "Studied ",
    highlight: "12 cards",
    suffix: " in Rust",
    typeLabel: "study",
  },
  {
    id: "fallback-4",
    timeLabel: "Yest.",
    prefix: "Imported ",
    highlight: "145 cards",
    suffix: " from .apkg",
    typeLabel: "import",
  },
  {
    id: "fallback-5",
    timeLabel: "Yest.",
    prefix: "Studied ",
    highlight: "31 cards",
    suffix: " global",
    typeLabel: "study",
  },
];

const FALLBACK_STREAK_OFFSETS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 17, 19, 22, 23, 24, 25, 28, 29, 33, 34, 38,
  39, 40, 44, 48, 49, 51, 55, 56, 60, 63, 67, 70, 71, 74, 78, 82, 85, 89, 90, 95, 100, 105,
];

type StudySessionState =
  | { scope: "global"; startedAt: number }
  | { scope: "space"; spaceId: string; startedAt: number };

type AiGenerateSessionState =
  | { scope: "global"; initialSpaceId: string | null }
  | { scope: "space"; spaceId: string };

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab["id"]>("dashboard");
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState(false);
  const [dismissedDailyCheckInDay, setDismissedDailyCheckInDay] = useState<string | null>(() =>
    getDismissedDailyCheckInDay(),
  );
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStatsRecord | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivityRecord[]>([]);
  const [spaceStats, setSpaceStats] = useState<SpaceStatsRecord[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [studySession, setStudySession] = useState<StudySessionState | null>(null);
  const [aiGenerateSession, setAiGenerateSession] = useState<AiGenerateSessionState | null>(null);
  const [isMutatingCards, setIsMutatingCards] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceError, setNewSpaceError] = useState<string | null>(null);
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const dismissed = hasDismissedOnboarding();
        await loadBootstrapState();
        const [nextSpaces, nextCards, nextDashboardStats, nextSpaceStats, nextRecentActivity] =
          await Promise.all([
            listSpaces(),
            listCards(),
            getDashboardStats(),
            listSpaceStats(),
            listRecentActivity(),
          ]);

        if (!cancelled) {
          setIsOnboardingDismissed(dismissed);
          setSpaces(nextSpaces);
          setCards(nextCards);
          setDashboardStats(nextDashboardStats);
          setRecentActivity(nextRecentActivity);
          setSpaceStats(nextSpaceStats);
        }
      } catch (nextError: unknown) {
        if (!cancelled) {
          setBootstrapError(
            nextError instanceof Error ? nextError.message : "Failed to load app state",
          );
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

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
        setIsCreateDialogOpen(false);
      }).then((dispose) => {
        unlisten = dispose;
      }),
    );

    return () => {
      unlisten?.();
    };
  }, []);

  const hasRealSpaces = spaces.length > 0;
  const now = Date.now();
  const todayDayKey = getTodayDayKey(now);
  const spaceStatsById = new Map(spaceStats.map((entry) => [entry.spaceId, entry]));
  const globalStreak = dashboardStats?.globalStreak ?? (hasRealSpaces ? 0 : 14);
  const studySummary =
    hasRealSpaces && dashboardStats ? buildStudySummary(spaces, dashboardStats) : FALLBACK_STUDY_SUMMARY;
  const isDailyCheckInActive =
    hasRealSpaces && dashboardStats
      ? shouldShowDailyCheckInPrompt(dashboardStats, dismissedDailyCheckInDay, todayDayKey)
      : false;
  const stats =
    hasRealSpaces && dashboardStats ? buildStats(dashboardStats) : FALLBACK_STATS;
  const spaceCards =
    hasRealSpaces ? buildSpaceCards(spaces, cards, spaceStatsById, now) : FALLBACK_SPACES;
  const activity = hasRealSpaces ? buildActivity(recentActivity, now) : FALLBACK_ACTIVITY;
  const streakCells = buildStreakCells(dashboardStats?.studyDays ?? [], hasRealSpaces);
  const selectedSpaceStats =
    selectedSpaceId !== null ? spaceStatsById.get(selectedSpaceId) ?? null : null;
  const selectedSpace =
    selectedSpaceId !== null ? spaces.find((space) => space.id === selectedSpaceId) ?? null : null;
  const studySpace =
    studySession?.scope === "space"
      ? spaces.find((space) => space.id === studySession.spaceId) ?? null
      : null;
  const aiGenerateSpace =
    aiGenerateSession?.scope === "space"
      ? spaces.find((space) => space.id === aiGenerateSession.spaceId) ?? null
      : null;
  const studyCards =
    studySession?.scope === "space"
      ? cards.filter((card) => card.spaceId === studySession.spaceId)
      : cards;
  const shouldShowOnboarding =
    !selectedSpace &&
    !studySession &&
    !aiGenerateSession &&
    !isOnboardingDismissed;

  async function refreshAppData() {
    const [nextSpaces, nextCards, nextDashboardStats, nextSpaceStats, nextRecentActivity] =
      await Promise.all([
        listSpaces(),
        listCards(),
        getDashboardStats(),
        listSpaceStats(),
        listRecentActivity(),
      ]);
    setSpaces(nextSpaces);
    setCards(nextCards);
    setDashboardStats(nextDashboardStats);
    setRecentActivity(nextRecentActivity);
    setSpaceStats(nextSpaceStats);
  }

  async function handleCreateCard(input: {
    back: string;
    front: string;
    spaceId: string;
    tags: string[];
    source?: CardRecord["source"];
  }) {
    setIsMutatingCards(true);

    try {
      const createdCard = await createCard(input);
      setCards((currentCards) => sortCardRecords([createdCard, ...currentCards]));
      await refreshAppData();
    } finally {
      setIsMutatingCards(false);
    }
  }

  async function handleUpdateCard(input: {
    back: string;
    front: string;
    id: string;
    spaceId: string;
    tags: string[];
  }) {
    setIsMutatingCards(true);

    try {
      const updatedCard = await updateCard(input);
      setCards((currentCards) =>
        sortCardRecords(
          currentCards.map((card) => (card.id === updatedCard.id ? updatedCard : card)),
        ),
      );
      await refreshAppData();
    } finally {
      setIsMutatingCards(false);
    }
  }

  async function handleDeleteCard(input: { id: string }) {
    setIsMutatingCards(true);

    try {
      await deleteCard(input);
      setCards((currentCards) => currentCards.filter((card) => card.id !== input.id));
      await refreshAppData();
    } finally {
      setIsMutatingCards(false);
    }
  }

  async function handleReviewCard(input: { card: CardRecord; grade: 1 | 2 | 3 | 4 }) {
    setIsMutatingCards(true);

    try {
      const updatedCard = await reviewCard(input);
      const [nextSpaces, nextDashboardStats, nextSpaceStats, nextRecentActivity] =
        await Promise.all([
          listSpaces(),
          getDashboardStats(),
          listSpaceStats(),
          listRecentActivity(),
        ]);
      setCards((currentCards) =>
        sortCardRecords(
          currentCards.map((card) => (card.id === updatedCard.id ? updatedCard : card)),
        ),
      );
      setSpaces(nextSpaces);
      setDashboardStats(nextDashboardStats);
      setRecentActivity(nextRecentActivity);
      setSpaceStats(nextSpaceStats);
      return updatedCard;
    } finally {
      setIsMutatingCards(false);
    }
  }

  async function handleCreateSpaceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNewSpaceError(null);
    setIsCreatingSpace(true);

    try {
      await handleCreateSpace(newSpaceName);
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

  async function handleCreateSpace(name: string) {
    const createdSpace = await createSpace({ name });
    setSpaces((currentSpaces) => sortSpaces([createdSpace, ...currentSpaces]));
    return createdSpace;
  }

  function handleStartGlobalStudy() {
    if (dashboardStats?.dueToday) {
      setDismissedDailyCheckInDay(dismissDailyCheckIn(todayDayKey));
    }
    setStudySession({ scope: "global", startedAt: Date.now() });
  }

  function handleStartSpaceStudy(spaceId: string) {
    setStudySession({ scope: "space", spaceId, startedAt: Date.now() });
  }

  function handleStudySecondaryAction() {
    const targetSpace =
      [...spaces]
        .sort(
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
  }

  function handleOpenSettingsFromAi() {
    setAiGenerateSession(null);
    setSelectedSpaceId(null);
    setActiveTab("settings");
  }

  async function handleSaveApprovedAiCards(input: {
    cards: Array<{ back: string; front: string; tags: string[] }>;
    spaceId: string;
  }) {
    setIsMutatingCards(true);

    try {
      await Promise.all(
        input.cards.map((card) =>
          createCard({
            ...card,
            source: "ai",
            spaceId: input.spaceId,
          }),
        ),
      );
      await refreshAppData();
      setAiGenerateSession(null);
      setSelectedSpaceId(input.spaceId);
      window.scrollTo({ top: 0, behavior: "auto" });
    } finally {
      setIsMutatingCards(false);
    }
  }

  async function handleResetAllData() {
    await resetAllData();
    setSelectedSpaceId(null);
    setStudySession(null);
    setAiGenerateSession(null);
    setDismissedDailyCheckInDay(null);
    await refreshAppData();
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
              <AiGenerateScreen
                backLabel={
                  aiGenerateSession.scope === "space"
                    ? aiGenerateSpace?.name ?? "Space"
                    : "Dashboard"
                }
                initialSpaceId={
                  aiGenerateSession.scope === "space"
                    ? aiGenerateSession.spaceId
                    : aiGenerateSession.initialSpaceId
                }
                onBack={handleCloseAiGenerate}
                onCreateSpace={handleCreateSpace}
                onOpenSettings={handleOpenSettingsFromAi}
                onSaveApprovedCards={handleSaveApprovedAiCards}
                spaces={spaces}
              />
            ) : studySession ? (
              <StudyScreen
                cards={studyCards}
                onBack={handleCloseStudySession}
                onReviewCard={handleReviewCard}
                sessionKey={studySession.startedAt}
                scope={studySession.scope as StudyScope}
                scopeLabel={studySession.scope === "space" ? studySpace?.name ?? "Space" : "All spaces"}
                space={studySpace}
              />
            ) : selectedSpace ? (
              <SpaceDetailsScreen
                cards={cards}
                isMutating={isMutatingCards}
                onBack={handleCloseSpaceDetails}
                onCreateCard={handleCreateCard}
                onDeleteCard={handleDeleteCard}
                onOpenAiGenerate={() => handleOpenSpaceAiGenerate(selectedSpace.id)}
                onStartStudy={() => handleStartSpaceStudy(selectedSpace.id)}
                stats={selectedSpaceStats}
                onUpdateCard={handleUpdateCard}
                space={selectedSpace}
              />
            ) : (
              <>
                <AppTitlebar
                  activeTab={activeTab}
                  globalStreak={activeTab === "dashboard" ? globalStreak : null}
                  onOpenCreateDialog={handleOpenCreateDialog}
                  onSelectTab={setActiveTab}
                  tabs={APP_TABS}
                />

                {activeTab === "dashboard" ? (
                  <Dashboard
                    activity={activity}
                    isDailyCheckInActive={isDailyCheckInActive}
                    onOpenCreateDialog={handleOpenCreateDialog}
                    onOpenSpace={handleOpenSpace}
                    onStudyPrimaryAction={hasRealSpaces ? handleStartGlobalStudy : handleOpenCreateDialog}
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
                    onCreateCard={handleCreateCard}
                    onDeleteCard={handleDeleteCard}
                    onOpenCreateDialog={handleOpenCreateDialog}
                    onUpdateCard={handleUpdateCard}
                    spaces={spaces}
                  />
                ) : activeTab === "import" ? (
                  <ImportScreen
                    onImportComplete={refreshAppData}
                    onOpenCards={() => setActiveTab("cards")}
                    onStudyNow={handleStartGlobalStudy}
                  />
                ) : activeTab === "settings" ? (
                  <SettingsScreen
                    cardsCount={cards.length}
                    onResetAllData={handleResetAllData}
                    spacesCount={spaces.length}
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
        </>
      )}
    </main>
  );
}

function buildStudySummary(
  spaces: SpaceSummary[],
  dashboardStats: DashboardStatsRecord,
): StudySummary {
  const totalDueToday = dashboardStats.dueToday;
  const totalCards = spaces.reduce((sum, space) => sum + space.cardCount, 0);
  const dueSpaces = [...spaces]
    .filter((space) => space.dueTodayCount > 0)
    .sort(
      (left, right) => right.dueTodayCount - left.dueTodayCount || right.updatedAt - left.updatedAt,
    );

  if (totalDueToday === 0) {
    const largestSpaces = [...spaces]
      .sort((left, right) => right.cardCount - left.cardCount || right.updatedAt - left.updatedAt)
      .slice(0, 3)
      .filter((space) => space.cardCount > 0)
      .map((space) => ({ label: space.name, value: space.cardCount }));

    return {
      eyebrow: "Queue cleared",
      headline: spaces.length === 0 ? "Create your first study space" : "No cards due right now",
      description:
        spaces.length === 0
          ? "Start with a space, then import or generate cards to build your review queue."
          : `${formatCount(totalCards, "card")} across ${formatCount(spaces.length, "space")}. Everything currently scheduled has been reviewed.`,
      breakdown: largestSpaces,
      primaryActionLabel: spaces.length === 0 ? "New Space" : "Study all →",
      secondaryActionLabel: "Per space",
    };
  }

  const topBreakdown = dueSpaces.slice(0, 3).map((space) => ({
    label: space.name,
    value: space.dueTodayCount,
  }));
  const remainingDue = dueSpaces
    .slice(3)
    .reduce((sum, space) => sum + space.dueTodayCount, 0);
  const breakdown =
    remainingDue > 0 ? [...topBreakdown, { label: "other", value: remainingDue }] : topBreakdown;
  const leadingNames = dueSpaces.slice(0, 2).map((space) => space.name);

  return {
    eyebrow: "Ready to study",
    headline: `${formatNumber(totalDueToday)} cards due today`,
    description: `Across ${formatCount(spaces.length, "space")}. ${formatNumber(
      dashboardStats.studiedToday,
    )} already reviewed — ${formatNumber(totalDueToday)} remaining${
      leadingNames.length > 0 ? `. Most overdue in ${joinLabels(leadingNames)}.` : "."
    }`,
    breakdown,
    primaryActionLabel: "Study all →",
    secondaryActionLabel: "Per space",
  };
}

function buildStats(stats: DashboardStatsRecord): StatCardData[] {
  return [
    {
      label: "Total cards",
      value: formatNumber(stats.totalCards),
      subtext: stats.totalCards > 0 ? "Across your full library" : "No cards yet",
    },
    {
      label: "Studied today",
      value: formatNumber(stats.studiedToday),
      unit: stats.dueToday > 0 ? ` / ${formatNumber(stats.dueToday)}` : undefined,
      subtext: stats.dueToday > 0 ? "due remaining" : "Queue cleared",
    },
    {
      label: "Due today",
      value: formatNumber(stats.dueToday),
      subtext: stats.dueToday > 0 ? "Reviews ready now" : "Nothing scheduled",
    },
    {
      label: "Global streak",
      value: formatNumber(stats.globalStreak),
      unit: "days",
      subtext: stats.globalStreak > 0 ? "Across all study sessions" : "No streak yet",
    },
  ];
}

function shouldShowDailyCheckInPrompt(
  dashboardStats: DashboardStatsRecord,
  dismissedDay: string | null,
  todayDayKey: string,
) {
  return dashboardStats.dueToday > 0 && dismissedDay !== todayDayKey;
}

function buildSpaceCards(
  spaces: SpaceSummary[],
  cards: CardRecord[],
  spaceStats: Map<string, SpaceStatsRecord>,
  now: number,
): SpaceCardData[] {
  return [...spaces]
    .sort((left, right) => right.dueTodayCount - left.dueTodayCount || right.updatedAt - left.updatedAt)
    .map((space) => {
      const stats = spaceStats.get(space.id) ?? null;
      const latestCard = [...cards]
        .filter((card) => card.spaceId === space.id)
        .sort((left, right) => right.updatedAt - left.updatedAt)[0];

      return {
        id: space.id,
        name: space.name,
        description: buildSpaceDescription(space),
        streakLabel: space.streak > 0 ? `${space.streak}d` : undefined,
        meta: [
          { label: "cards", value: formatNumber(space.cardCount) },
          {
            label: "due",
            value: formatNumber(space.dueTodayCount),
            variant: space.dueTodayCount > 0 ? "due" : "default",
          },
          {
            label: "retention",
            value:
              stats?.retention30d !== null && stats?.retention30d !== undefined
                ? `${Math.round(stats.retention30d)}%`
                : "—",
          },
          {
            label: "source",
            value: latestCard
              ? `${formatSourceLabel(latestCard.source)} · ${formatCompactAge(latestCard.updatedAt, now)}`
              : `local · ${formatCompactAge(space.updatedAt, now)}`,
            variant: "aux",
          },
        ],
      };
    });
}

function buildActivity(activity: RecentActivityRecord[], now: number): ActivityItem[] {
  return activity.map((entry) => ({
    id: entry.id,
    timeLabel: formatRelativeAge(entry.reviewTime, now),
    prefix: "Studied ",
    highlight: formatCount(entry.reviewCount, "card"),
    suffix: ` in ${entry.spaceName}`,
    typeLabel: "study",
  }));
}

function buildStreakCells(studyDays: string[], hasRealSpaces: boolean): StreakCellData[] {
  const totalCells = 16 * 7;
  const studiedDays = new Set<string>();

  if (hasRealSpaces) {
    for (const day of studyDays) {
      studiedDays.add(day);
    }
  } else {
    for (const offset of FALLBACK_STREAK_OFFSETS) {
      studiedDays.add(formatDayOffset(offset));
    }
  }

  return Array.from({ length: totalCells }, (_, index) => {
    const dayOffset = totalCells - index - 1;
    const dateLabel = formatDayOffset(dayOffset);

    return {
      id: `streak-${dayOffset}`,
      studied: studiedDays.has(dateLabel),
      today: dayOffset === 0,
    };
  });
}

function buildSpaceDescription(space: SpaceSummary): string {
  if (space.cardCount === 0) {
    return "No cards in this space yet. Import a deck or generate new material to start scheduling reviews.";
  }

  if (space.dueTodayCount === 0) {
    return `${formatCount(space.cardCount, "card")} loaded. Nothing due today, so the queue is fully caught up.`;
  }

  return `${formatCount(space.cardCount, "card")} loaded with ${formatCount(
    space.dueTodayCount,
    "review",
  )} due today.`;
}

function sortSpaces(spaces: SpaceSummary[]): SpaceSummary[] {
  return [...spaces].sort(
    (left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt,
  );
}

function sortCardRecords(cards: CardRecord[]): CardRecord[] {
  return [...cards].sort(
    (left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt,
  );
}

function formatCount(value: number, label: string): string {
  return `${formatNumber(value)} ${label}${value === 1 ? "" : "s"}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatRelativeAge(timestamp: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - timestamp) / (60 * 1000)));

  if (minutes < 1) {
    return "now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.round(days / 7);

  if (weeks < 5) {
    return `${weeks}w ago`;
  }

  const months = Math.round(days / 30);

  return `${months}mo ago`;
}

function formatCompactAge(timestamp: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - timestamp) / (60 * 1000)));

  if (minutes < 60) {
    return minutes <= 1 ? "just now" : `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.floor(days / 7);

  if (weeks < 5) {
    return `${weeks}w ago`;
  }

  const months = Math.floor(days / 30);

  return `${months}mo ago`;
}

function formatDayOffset(offset: number) {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - offset);
  const year = day.getFullYear();
  const month = `${day.getMonth() + 1}`.padStart(2, "0");
  const date = `${day.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function formatSourceLabel(source: CardRecord["source"]) {
  switch (source) {
    case "ai":
      return "ai";
    case "anki":
      return "anki";
    default:
      return "manual";
  }
}

function joinLabels(labels: string[]): string {
  if (labels.length === 0) {
    return "";
  }

  if (labels.length === 1) {
    return labels[0];
  }

  return `${labels.slice(0, -1).join(" and ")} and ${labels.at(-1)}`;
}
