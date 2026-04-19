import type {
  ActivityItem,
  SpaceCardData,
  StatCardData,
  StudySummary,
} from "../components/dashboard";

export const FALLBACK_STUDY_SUMMARY: StudySummary = {
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

export const FALLBACK_STATS: StatCardData[] = [
  { label: "Total cards", value: "847", trend: "↑ 23", subtext: "this week" },
  { label: "Studied today", value: "18", unit: "/ 42", subtext: "due remaining" },
  { label: "Retention", value: "87", unit: "%", trend: "↑ 3%", subtext: "vs last month" },
  { label: "Streak", value: "14", unit: "days", subtext: "personal best" },
];

export const FALLBACK_SPACES: SpaceCardData[] = [
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
    description: "Borrow checker, lifetimes, move semantics, smart pointers, interior mutability.",
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
    description: "Ancient civilizations, revolutions, world wars, Cold War, colonialism, treaties.",
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

export const FALLBACK_ACTIVITY: ActivityItem[] = [
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

export const FALLBACK_STREAK_OFFSETS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 17, 19, 22, 23, 24, 25, 28, 29, 33, 34, 38, 39,
  40, 44, 48, 49, 51, 55, 56, 60, 63, 67, 70, 71, 74, 78, 82, 85, 89, 90, 95, 100, 105,
];
