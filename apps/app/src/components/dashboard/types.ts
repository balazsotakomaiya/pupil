export type StudyBreakdownItem = {
  label: string;
  value: number;
};

export type StudySummary = {
  eyebrow: string;
  headline: string;
  description: string;
  breakdown: StudyBreakdownItem[];
  primaryActionLabel: string;
  secondaryActionLabel: string;
};

export type StatCardData = {
  label: string;
  value: string;
  unit?: string;
  trend?: string;
  subtext: string;
};

export type SpaceCardMeta = {
  label: string;
  value: string;
  variant?: "default" | "due" | "aux";
};

export type SpaceCardData = {
  id: string;
  name: string;
  description: string;
  streakLabel?: string;
  meta: SpaceCardMeta[];
};

export type ActivityItem = {
  id: string;
  timeLabel: string;
  prefix: string;
  highlight: string;
  suffix?: string;
  typeLabel: string;
};

export type StreakCellData = {
  id: string;
  studied: boolean;
  today: boolean;
};
