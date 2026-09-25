import { useEffect, useState } from "react";
import { RulersOverlay } from "../brand";
import styles from "./LaunchScreen.module.css";

const EYE_PATH = "M 2 26 C 12 10, 40 10, 50 26 C 40 42, 12 42, 2 26 Z";

/** Long enough for the eye to open and glance once; short enough not to be a toll. */
export const LAUNCH_MIN_VISIBLE_MS = 1450;
const REDUCED_MOTION_MIN_VISIBLE_MS = 200;
export const LAUNCH_EXIT_MS = 480;

type LaunchPhase = "intro" | "exit" | "done";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The first thing a window shows: the eye draws itself closed, opens, and
 * glances once before dissolving into the app underneath. It holds until the
 * app is ready, never less than one full opening, and a click skips it.
 */
export function LaunchScreen({ ready }: { ready: boolean }) {
  const [phase, setPhase] = useState<LaunchPhase>("intro");
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setIntroDone(true),
      prefersReducedMotion() ? REDUCED_MOTION_MIN_VISIBLE_MS : LAUNCH_MIN_VISIBLE_MS,
    );
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase === "intro" && ready && introDone) {
      setPhase("exit");
    }
  }, [introDone, phase, ready]);

  useEffect(() => {
    if (phase !== "exit") {
      return;
    }
    const timer = window.setTimeout(() => setPhase("done"), LAUNCH_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === "done") {
    return null;
  }

  return (
    <div
      className={`${styles.launch} ${phase === "exit" ? styles.exiting : ""}`}
      data-testid="launch-screen"
      onPointerDown={() => setIntroDone(true)}
    >
      <RulersOverlay drawIn />
      <div className={styles.mark} aria-hidden="true">
        <svg className={styles.eye} viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
          <g className={styles.lids}>
            <path
              className={styles.outline}
              d={EYE_PATH}
              fill="none"
              pathLength={1}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.8"
            />
          </g>
          <circle
            className={styles.iris}
            cx="26"
            cy="26"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <g className={styles.gaze}>
            <circle className={styles.pupil} cx="26" cy="26" r="3.5" fill="currentColor" />
          </g>
        </svg>
        <span className={styles.wordmark}>pupil</span>
      </div>
      <span className="sr-only" role="status">
        {ready ? "Pupil is ready." : "Opening Pupil."}
      </span>
    </div>
  );
}
