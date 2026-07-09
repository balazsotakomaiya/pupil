import aiReviewScreenshot from "../assets/screenshots/ai-review.png";
import commandPaletteScreenshot from "../assets/screenshots/command-palette.png";
import importScreenshot from "../assets/screenshots/import.png";
import spaceStatsScreenshot from "../assets/screenshots/space-stats.png";
import studyFrontScreenshot from "../assets/screenshots/study-front.png";
import studyReviewScreenshot from "../assets/screenshots/study-review.png";

export const SCREENSHOTS = [
  {
    title: "Approve every card",
    caption: "Pupil drafts the cards. You decide which ones make it into your deck.",
    src: aiReviewScreenshot,
    alt: "Reviewing AI-generated flashcards with discard and approve controls",
  },
  {
    title: "Study mode",
    caption: "A clean, deeply focused, distraction-free study view.",
    src: studyFrontScreenshot,
    alt: "Study screen showing the front of a flashcard before revealing the answer",
  },
  {
    title: "Answer reveal",
    caption: "Asses your recall and build toward long-term retention.",
    src: studyReviewScreenshot,
    alt: "Study screen showing a revealed flashcard answer and FSRS rating buttons",
  },
  {
    title: "Space stats",
    caption: "Inspect card states, recent activity, and the cards inside each space.",
    src: spaceStatsScreenshot,
    alt: "Space detail screen showing review activity, card states, and recent cards",
  },
  {
    title: "The Command Palette",
    caption: "Open the command palette to study, generate, import, or jump around.",
    src: commandPaletteScreenshot,
    alt: "Command palette overlay listing actions and spaces",
  },
  {
    title: "Anki import",
    caption: "Bring existing .apkg decks into local spaces.",
    src: importScreenshot,
    alt: "Import screen for adding Anki .apkg files",
  },
];
