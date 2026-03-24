import { useEffect, useState, type FormEvent } from "react";
import {
  Dashboard,
  type ActivityItem,
  type DashboardTab,
  type SpaceCardData,
  type StatCardData,
  type StreakCellData,
  type StudySummary,
} from "./components/dashboard";
import { loadBootstrapState } from "./lib/bootstrap";
import { createSpace, listSpaces, type SpaceSummary } from "./lib/spaces";

const DASHBOARD_TABS: DashboardTab[] = [
  { label: "Dashboard", active: true },
  { label: "All Cards" },
  { label: "Import" },
  { label: "Settings" },
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

export default function App() {
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceError, setNewSpaceError] = useState<string | null>(null);
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        await loadBootstrapState();
        const nextSpaces = await listSpaces();

        if (!cancelled) {
          setSpaces(nextSpaces);
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

  const hasRealSpaces = spaces.length > 0;
  const now = Date.now();
  const longestStreak = hasRealSpaces ? Math.max(...spaces.map((space) => space.streak), 0) : 14;
  const studySummary = hasRealSpaces ? buildStudySummary(spaces) : FALLBACK_STUDY_SUMMARY;
  const stats = hasRealSpaces ? buildStats(spaces, now, longestStreak) : FALLBACK_STATS;
  const spaceCards = hasRealSpaces ? buildSpaceCards(spaces, now) : FALLBACK_SPACES;
  const activity = hasRealSpaces ? buildActivity(spaces, now) : FALLBACK_ACTIVITY;
  const streakCells = buildStreakCells(hasRealSpaces ? longestStreak : 14, hasRealSpaces);

  async function handleCreateSpaceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNewSpaceError(null);
    setIsCreatingSpace(true);

    try {
      const createdSpace = await createSpace({ name: newSpaceName });

      setSpaces((currentSpaces) => sortSpaces([createdSpace, ...currentSpaces]));
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
        <Dashboard
          activity={activity}
          isCreateDialogOpen={isCreateDialogOpen}
          isCreatingSpace={isCreatingSpace}
          newSpaceError={newSpaceError}
          newSpaceName={newSpaceName}
          onCloseCreateDialog={handleCloseCreateDialog}
          onCreateNameChange={setNewSpaceName}
          onOpenCreateDialog={handleOpenCreateDialog}
          onStudyPrimaryAction={hasRealSpaces ? undefined : handleOpenCreateDialog}
          onSubmitCreateDialog={handleCreateSpaceSubmit}
          spaces={spaceCards}
          stats={stats}
          streakCells={streakCells}
          streakCount={longestStreak}
          studySummary={studySummary}
          tabs={DASHBOARD_TABS}
        />
      )}
    </main>
  );
}

function buildStudySummary(spaces: SpaceSummary[]): StudySummary {
  const totalDueToday = spaces.reduce((sum, space) => sum + space.dueTodayCount, 0);
  const totalCards = spaces.reduce((sum, space) => sum + space.cardCount, 0);
  const dueSpaces = [...spaces]
    .filter((space) => space.dueTodayCount > 0)
    .sort((left, right) => right.dueTodayCount - left.dueTodayCount || right.updatedAt - left.updatedAt);

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
  const remainingDue = dueSpaces.slice(3).reduce((sum, space) => sum + space.dueTodayCount, 0);
  const breakdown = remainingDue > 0 ? [...topBreakdown, { label: "other", value: remainingDue }] : topBreakdown;
  const leadingNames = dueSpaces.slice(0, 2).map((space) => space.name);

  return {
    eyebrow: "Ready to study",
    headline: `${formatNumber(totalDueToday)} cards due today`,
    description: `${formatCount(
      spaces.length,
      "space",
    )}. ${formatCount(dueSpaces.length, "space")} currently need attention${
      leadingNames.length > 0 ? `. Heaviest in ${joinLabels(leadingNames)}.` : "."
    }`,
    breakdown,
    primaryActionLabel: "Study all →",
    secondaryActionLabel: "Per space",
  };
}

function buildStats(spaces: SpaceSummary[], now: number, longestStreak: number): StatCardData[] {
  const totalCards = spaces.reduce((sum, space) => sum + space.cardCount, 0);
  const dueToday = spaces.reduce((sum, space) => sum + space.dueTodayCount, 0);
  const touchedThisWeek = spaces.filter((space) => now - space.updatedAt < 7 * 24 * 60 * 60 * 1000).length;
  const spacesWithDue = spaces.filter((space) => space.dueTodayCount > 0).length;

  return [
    {
      label: "Total cards",
      value: formatNumber(totalCards),
      subtext: totalCards > 0 ? `${formatCount(spaces.length, "space")} in rotation` : "No cards yet",
    },
    {
      label: "Due today",
      value: formatNumber(dueToday),
      subtext: dueToday > 0 ? `${formatCount(spacesWithDue, "space")} with reviews queued` : "Nothing scheduled",
    },
    {
      label: "Active spaces",
      value: formatNumber(spaces.length),
      subtext: touchedThisWeek > 0 ? `${formatCount(touchedThisWeek, "space")} touched this week` : "No recent updates",
    },
    {
      label: "Longest streak",
      value: formatNumber(longestStreak),
      unit: "days",
      subtext: longestStreak > 0 ? "Current best across spaces" : "No streaks yet",
    },
  ];
}

function buildSpaceCards(spaces: SpaceSummary[], now: number): SpaceCardData[] {
  return [...spaces]
    .sort((left, right) => {
      return right.dueTodayCount - left.dueTodayCount || right.updatedAt - left.updatedAt;
    })
    .map((space) => ({
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
          label: "status",
          value: space.cardCount > 0 ? "Ready" : "Empty",
        },
        {
          label: "updated",
          value: `local · ${formatCompactAge(space.updatedAt, now)}`,
          variant: "aux",
        },
      ],
    }));
}

function buildActivity(spaces: SpaceSummary[], now: number): ActivityItem[] {
  const recentSpaces = [...spaces]
    .sort((left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt)
    .slice(0, 5);

  return recentSpaces.map((space) => {
    if (space.createdAt === space.updatedAt) {
      return {
        id: `activity-${space.id}`,
        timeLabel: formatRelativeAge(space.createdAt, now),
        prefix: "Created ",
        highlight: space.name,
        suffix: " space",
        typeLabel: "space",
      };
    }

    if (space.dueTodayCount > 0) {
      return {
        id: `activity-${space.id}`,
        timeLabel: formatRelativeAge(space.updatedAt, now),
        prefix: "Queued ",
        highlight: formatCount(space.dueTodayCount, "card"),
        suffix: ` in ${space.name}`,
        typeLabel: "study",
      };
    }

    if (space.cardCount > 0) {
      return {
        id: `activity-${space.id}`,
        timeLabel: formatRelativeAge(space.updatedAt, now),
        prefix: "Tracking ",
        highlight: formatCount(space.cardCount, "card"),
        suffix: ` in ${space.name}`,
        typeLabel: "cards",
      };
    }

    return {
      id: `activity-${space.id}`,
      timeLabel: formatRelativeAge(space.updatedAt, now),
      prefix: "Updated ",
      highlight: space.name,
      typeLabel: "space",
    };
  });
}

function buildStreakCells(streakCount: number, hasRealSpaces: boolean): StreakCellData[] {
  const totalCells = 16 * 7;
  const studiedOffsets = new Set<number>();

  if (hasRealSpaces) {
    for (let index = 0; index < streakCount; index += 1) {
      studiedOffsets.add(index);
    }
  } else {
    for (const offset of FALLBACK_STREAK_OFFSETS) {
      studiedOffsets.add(offset);
    }
  }

  return Array.from({ length: totalCells }, (_, index) => {
    const dayOffset = totalCells - index - 1;

    return {
      id: `streak-${dayOffset}`,
      studied: studiedOffsets.has(dayOffset),
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

function joinLabels(labels: string[]): string {
  if (labels.length === 0) {
    return "";
  }

  if (labels.length === 1) {
    return labels[0];
  }

  return `${labels.slice(0, -1).join(" and ")} and ${labels.at(-1)}`;
}
