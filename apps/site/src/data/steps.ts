import aiGenerateScreenshot from "../assets/screenshots/ai-generate.png";
import aiReviewScreenshot from "../assets/screenshots/ai-review.png";
import studyReviewScreenshot from "../assets/screenshots/study-review.png";

export type Step = {
  title: string;
  desc: string;
  src: string;
  alt: string;
};

export const STEPS: Step[] = [
  {
    title: "Generate",
    desc: "Type any topic. Pick a difficulty and card style. Pupil's AI drafts a full deck in seconds — from scratch.",
    src: aiGenerateScreenshot,
    alt: "AI Generate screen with topic prompt, space picker, difficulty, style, count, and Auto controls",
  },
  {
    title: "Review",
    desc: "Approve, edit, or discard cards before they land in your space. You decide what's worth learning.",
    src: aiReviewScreenshot,
    alt: "Review generated cards screen with per-card regenerate, discard, and approve actions",
  },
  {
    title: "Retain",
    desc: "FSRS-5 schedules each card at exactly the right moment. Study less time, remember far more.",
    src: studyReviewScreenshot,
    alt: "Study screen with revealed answer and FSRS Again, Hard, Good, and Easy buttons",
  },
];
