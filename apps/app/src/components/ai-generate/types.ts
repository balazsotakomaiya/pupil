export type AiDifficulty = "Beginner" | "Intermediate" | "Advanced";
export type AiStyle = "Concept" | "Q&A" | "Cloze";
export type AiGenerateMode = "no-key" | "form" | "loading" | "error" | "review";

export type AiGenerateDraft = {
  autoCount: boolean;
  count: number;
  difficulty: AiDifficulty;
  newSpaceName: string;
  spaceId: string;
  style: AiStyle;
  topic: string;
};

export type GeneratedCardCandidate = {
  back: string;
  front: string;
  id: string;
  status: "approved" | "discarded" | "pending";
  tags: string[];
};
