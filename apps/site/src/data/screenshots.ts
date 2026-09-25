import commandPaletteScreenshot from "../assets/screenshots/command-palette.png";
import dashboardScreenshot from "../assets/screenshots/dashboard.png";
import importScreenshot from "../assets/screenshots/import.png";
import spaceStatsScreenshot from "../assets/screenshots/space-stats.png";

export type ScreenshotMeta = {
  title: string;
  caption: string;
  alt: string;
  src: string;
};

/** A screenshot shown as a zoomed crop; focus is the 0–1 point kept centered. */
export type DetailShot = ScreenshotMeta & { focus: [number, number]; zoom: number };

export const DASHBOARD_SCREENSHOT: ScreenshotMeta = {
  title: "Dashboard",
  caption: "See what is due today, library totals, and every space in one place.",
  alt: "Pupil dashboard with due queue, study stats, and spaces list",
  src: dashboardScreenshot,
};

export const DETAIL_SHOTS: DetailShot[] = [
  {
    title: "Space overview",
    caption:
      "Due counts, retention, review activity, FSRS card states, and recent cards for one space.",
    src: spaceStatsScreenshot,
    alt: "Space detail screen with metrics, review activity chart, card states, and recent activity table",
    focus: [0.5, 0.42],
    zoom: 1.45,
  },
  {
    title: "Command palette",
    caption:
      "Search cards, spaces, or actions—study due cards, generate, import, or open settings from one overlay.",
    src: commandPaletteScreenshot,
    alt: "Command palette overlay with search field, actions list, and spaces list over the dashboard",
    focus: [0.5, 0.46],
    zoom: 1.75,
  },
  {
    title: "Anki import",
    caption:
      "Drag an .apkg file in; each Anki deck can become its own Pupil space with fresh FSRS scheduling.",
    src: importScreenshot,
    alt: "Import screen with drop zone for .apkg files, deck-to-space option, and last import history",
    focus: [0.5, 0.47],
    zoom: 1.5,
  },
];
