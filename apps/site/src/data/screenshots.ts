import aiGenerateScreenshot from "../assets/screenshots/ai-generate.png";
import aiReviewScreenshot from "../assets/screenshots/ai-review.png";
import commandPaletteScreenshot from "../assets/screenshots/command-palette.png";
import dashboardScreenshot from "../assets/screenshots/dashboard.png";
import importScreenshot from "../assets/screenshots/import.png";
import spaceStatsScreenshot from "../assets/screenshots/space-stats.png";
import studyFrontScreenshot from "../assets/screenshots/study-front.png";
import studyReviewScreenshot from "../assets/screenshots/study-review.png";

export type ScreenshotMeta = {
  title: string;
  caption: string;
  alt: string;
  src: string;
};

export const DASHBOARD_SCREENSHOT: ScreenshotMeta = {
  title: "Dashboard",
  caption: "See what is due today, library totals, and every space in one place.",
  alt: "Pupil dashboard with due queue, study stats, and spaces list",
  src: dashboardScreenshot,
};

const aiGenerateBody =
  "Describe a topic, pick a space and options, then review generated cards before saving anything.";

export const AI_GENERATE_FEATURE: ScreenshotMeta & {
  kicker: string;
  heading: string;
  body: string;
} = {
  kicker: "AI generation",
  heading: "Turn a topic into a reviewed deck",
  body: aiGenerateBody,
  title: "Generate flashcards",
  caption: aiGenerateBody,
  alt: "AI Generate screen with topic prompt, space picker, difficulty, style, count, and Auto controls",
  src: aiGenerateScreenshot,
};

export const SCREENSHOTS: ScreenshotMeta[] = [
  {
    title: "Approve before saving",
    caption:
      "Regenerate, discard, or approve each draft, then save only the cards you want into the space.",
    src: aiReviewScreenshot,
    alt: "Review generated cards screen with per-card regenerate, discard, and approve actions",
  },
  {
    title: "Study mode",
    caption: "Question first—tap Show answer or press Space when you are ready.",
    src: studyFrontScreenshot,
    alt: "Study screen showing the front of a flashcard and a Show answer control",
  },
  {
    title: "FSRS ratings",
    caption: "Rate recall with Again, Hard, Good, or Easy so FSRS schedules the next review.",
    src: studyReviewScreenshot,
    alt: "Study screen with revealed answer and FSRS Again, Hard, Good, and Easy buttons",
  },
  {
    title: "Space overview",
    caption:
      "Due counts, retention, review activity, FSRS card states, and recent cards for one space.",
    src: spaceStatsScreenshot,
    alt: "Space detail screen with metrics, review activity chart, card states, and recent activity table",
  },
  {
    title: "Command palette",
    caption:
      "Search cards, spaces, or actions—study due cards, generate, import, or open settings from one overlay.",
    src: commandPaletteScreenshot,
    alt: "Command palette overlay with search field, actions list, and spaces list over the dashboard",
  },
  {
    title: "Anki import",
    caption:
      "Drag an .apkg file in; each Anki deck can become its own Pupil space with fresh FSRS scheduling.",
    src: importScreenshot,
    alt: "Import screen with drop zone for .apkg files, deck-to-space option, and last import history",
  },
];
