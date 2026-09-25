export type Feature = { title: string; desc: string; spec: string };

export const FEATURE_GROUPS: { name: string; features: Feature[] }[] = [
  {
    name: "Learn",
    features: [
      {
        title: "AI batch generation",
        desc: "Type a topic. Get a full deck in seconds. Approve, discard, or regenerate individual cards before they land in your space.",
        spec: "Topic → deck",
      },
      {
        title: "FSRS-5 spaced repetition",
        desc: "The same algorithm modern Anki uses — provably more accurate than SM-2. Cards resurface exactly when your memory needs them.",
        spec: "FSRS-5",
      },
      {
        title: "Difficulty ratings",
        desc: "Rate each card Again, Hard, Good, or Easy after revealing the answer. See exactly when you'll see it next before you tap.",
        spec: "1 · 2 · 3 · 4",
      },
    ],
  },
  {
    name: "Organize",
    features: [
      {
        title: "Spaces",
        desc: 'Organize cards into named spaces like "Systems Design" or "Biology". Study globally or drill a single space.',
        spec: "Per topic",
      },
      {
        title: "Stats & streaks",
        desc: "Track retention rate, cards due, and daily streaks per space and globally. Know at a glance where your gaps are.",
        spec: "Retention",
      },
      {
        title: "Command palette",
        desc: "Jump to any space, start a study session, or generate cards — all from the keyboard. No mouse required.",
        spec: "⌘ K",
      },
    ],
  },
  {
    name: "Own it",
    features: [
      {
        title: "Local-first & open source",
        desc: "Your cards live on your device in a single SQLite file. No account. No cloud lock-in. Export any time.",
        spec: "SQLite · MIT",
      },
      {
        title: "Anki import",
        desc: "Bring your existing Anki decks along. Import .apkg files and keep studying without starting over.",
        spec: ".apkg",
      },
      {
        title: "Tiny footprint",
        desc: "Under 10 MB to download. Launches in under a second. Won't hog your RAM while you're doing real work.",
        spec: "< 10 MB",
      },
    ],
  },
];
