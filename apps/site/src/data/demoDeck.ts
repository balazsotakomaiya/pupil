export type Rating = "again" | "hard" | "good" | "easy";

export type DemoCard = {
  space: string;
  front: string;
  back: string;
  /** Next-review interval FSRS would show on each rating button. */
  intervals: Record<Rating, string>;
};

export const RATINGS: { id: Rating; label: string; key: string }[] = [
  { id: "again", label: "Again", key: "1" },
  { id: "hard", label: "Hard", key: "2" },
  { id: "good", label: "Good", key: "3" },
  { id: "easy", label: "Easy", key: "4" },
];

export const DEMO_DECK: DemoCard[] = [
  {
    space: "DSA",
    front: "What problem does Prim’s algorithm solve?",
    back: "Finds a minimum spanning tree — connects every vertex of a weighted, undirected graph with the least total edge weight.",
    intervals: { again: "1m", hard: "6m", good: "10m", easy: "8d" },
  },
  {
    space: "Maths",
    front: "Why is 1 not considered a prime number?",
    back: "A prime has exactly two distinct divisors. 1 has only one — excluding it keeps every prime factorisation unique.",
    intervals: { again: "1m", hard: "8m", good: "1d", easy: "6d" },
  },
  {
    space: "Systems Design",
    front: "What does a load balancer’s health check protect against?",
    back: "Sending traffic to an instance that is down. Failing nodes leave the rotation until they pass again.",
    intervals: { again: "1m", hard: "12m", good: "3d", easy: "11d" },
  },
  {
    space: "DSA",
    front: "What is the time complexity of binary search?",
    back: "O(log n) — every comparison halves the range that is left to search.",
    intervals: { again: "1m", hard: "10m", good: "5d", easy: "21d" },
  },
];

/** "8d" → "8 days", "1m" → "1 minute" */
export function spellInterval(short: string): string {
  const n = Number.parseInt(short, 10);
  const unit = short.replace(String(n), "");
  const words: Record<string, string> = { m: "minute", h: "hour", d: "day", mo: "month" };
  const word = words[unit] ?? unit;
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
