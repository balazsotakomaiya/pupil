import {
  BrainIcon,
  ChartIcon,
  CommandIcon,
  FeatherIcon,
  FolderIcon,
  ImportIcon,
  LockIcon,
  SparklesIcon,
  StarIcon,
} from "../icons";

export const FEATURES = [
  {
    title: "AI batch generation",
    desc: "Type a topic. Get a full deck in seconds. Approve, discard, or regenerate individual cards before they land in your space.",
    icon: <SparklesIcon />,
  },
  {
    title: "FSRS-5 spaced repetition",
    desc: "The same algorithm modern Anki uses — provably more accurate than SM-2. Cards resurface exactly when your memory needs them.",
    icon: <BrainIcon />,
  },
  {
    title: "Spaces",
    desc: 'Organize cards into named spaces like "Systems Design" or "Biology". Study globally or drill a single space.',
    icon: <FolderIcon />,
  },
  {
    title: "Difficulty ratings",
    desc: "Rate each card Again, Hard, Good, or Easy after revealing the answer. See exactly when you'll see it next before you tap.",
    icon: <StarIcon />,
  },
  {
    title: "Stats & streaks",
    desc: "Track retention rate, cards due, and daily streaks per space and globally. Know at a glance where your gaps are.",
    icon: <ChartIcon />,
  },
  {
    title: "Local-first & open source",
    desc: "Your cards live on your device in a single SQLite file. No account. No cloud lock-in. Export any time.",
    icon: <LockIcon />,
  },
  {
    title: "Anki import",
    desc: "Bring your existing Anki decks along. Import .apkg files and keep studying without starting over.",
    icon: <ImportIcon />,
  },
  {
    title: "Command palette",
    desc: "Jump to any space, start a study session, or generate cards — all from the keyboard. No mouse required.",
    icon: <CommandIcon />,
  },
  {
    title: "Tiny footprint",
    desc: "Under 10 MB to download. Launches in under a second. Won't hog your RAM while you're doing real work.",
    icon: <FeatherIcon />,
  },
];
