import type {
  ActivityItem,
  SpaceCardData,
  StatCardData,
  StreakCellData,
  StudySummary,
} from "../components/dashboard";
import type { RecentActivityRecord } from "./activity";
import type { CardRecord } from "./cards";
import { FALLBACK_STREAK_OFFSETS } from "./seed-data";
import type { SpaceSummary } from "./spaces";
import type { DashboardStats, SpaceStats } from "./stats";

export function buildStudySummary(
  spaces: SpaceSummary[],
  dashboardStats: DashboardStats,
  gatedNewCount = 0,
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

    if (gatedNewCount > 0) {
      return {
        eyebrow: "Daily limit reached",
        headline: "No more cards ready today",
        description: `${formatCount(gatedNewCount, "new card")} waiting behind your daily limit across ${formatCount(
          spaces.length,
          "space",
        )}. Come back tomorrow or raise the limit in Settings.`,
        breakdown: largestSpaces,
        primaryActionLabel: "Study all →",
        secondaryActionLabel: "Per space",
      };
    }

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
    }${
      gatedNewCount > 0
        ? ` ${formatCount(gatedNewCount, "new card")} held by your daily limit.`
        : ""
    }`,
    breakdown,
    primaryActionLabel: "Study all →",
    secondaryActionLabel: "Per space",
  };
}

export function buildStats(stats: DashboardStats, gatedNewCount = 0): StatCardData[] {
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
      subtext:
        gatedNewCount > 0
          ? `${formatNumber(gatedNewCount)} new held by limit`
          : stats.dueToday > 0
            ? "due remaining"
            : "Queue cleared",
    },
    {
      label: "Due today",
      value: formatNumber(stats.dueToday),
      subtext:
        gatedNewCount > 0
          ? `${formatNumber(gatedNewCount)} new held by limit`
          : stats.dueToday > 0
            ? "Reviews ready now"
            : "Nothing scheduled",
    },
    {
      label: "Global streak",
      value: formatNumber(stats.globalStreak),
      unit: "days",
      subtext: stats.globalStreak > 0 ? "Across all study sessions" : "No streak yet",
    },
  ];
}

export function shouldShowDailyCheckInPrompt(
  dashboardStats: DashboardStats,
  dismissedDay: string | null,
  todayDayKey: string,
) {
  return dashboardStats.dueToday > 0 && dismissedDay !== todayDayKey;
}

export function buildSpaceCards(
  spaces: SpaceSummary[],
  cards: CardRecord[],
  spaceStats: Map<string, SpaceStats>,
  now: number,
): SpaceCardData[] {
  return [...spaces]
    .sort(
      (left, right) => right.dueTodayCount - left.dueTodayCount || right.updatedAt - left.updatedAt,
    )
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

export function buildActivity(activity: RecentActivityRecord[], now: number): ActivityItem[] {
  return activity.map((entry) => ({
    id: entry.id,
    timeLabel: formatRelativeAge(entry.reviewTime, now),
    prefix: "Studied ",
    highlight: formatCount(entry.reviewCount, "card"),
    suffix: ` in ${entry.spaceName}`,
    typeLabel: "study",
  }));
}

export function buildStreakCells(
  studyDays: string[],
  hasRealSpaces: boolean,
  now = Date.now(),
): StreakCellData[] {
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
    const dateLabel = formatDayOffset(dayOffset, now);

    return {
      id: `streak-${dayOffset}`,
      studied: studiedDays.has(dateLabel),
      today: dayOffset === 0,
    };
  });
}

export function sortSpaces(spaces: SpaceSummary[]): SpaceSummary[] {
  return [...spaces].sort(
    (left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt,
  );
}

export function sortCardRecords(cards: CardRecord[]): CardRecord[] {
  return [...cards].sort(
    (left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt,
  );
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

function formatDayOffset(offset: number, now = Date.now()) {
  const day = new Date(now);
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
