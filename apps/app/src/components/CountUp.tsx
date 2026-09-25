import { useEffect, useState } from "react";

type CountUpProps = {
  className?: string;
  /** Wait before counting, so the number can land with its surroundings. */
  delayMs?: number;
  durationMs?: number;
  value: number;
};

function prefersReducedMotion() {
  return (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Counts an integer up from zero on mount, easing out as it lands. */
export function CountUp({ className, delayMs = 0, durationMs = 700, value }: CountUpProps) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));

  useEffect(() => {
    if (prefersReducedMotion() || value === 0) {
      setShown(value);
      return;
    }

    let frame = 0;
    let start: number | null = null;
    const tick = (time: number) => {
      start ??= time + delayMs;
      const progress = Math.min(1, Math.max(0, (time - start) / durationMs));
      const eased = 1 - (1 - progress) ** 3;
      setShown(Math.round(value * eased));
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [delayMs, durationMs, value]);

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {shown}
    </span>
  );
}
