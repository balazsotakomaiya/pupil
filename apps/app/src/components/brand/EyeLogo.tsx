import styles from "./EyeLogo.module.css";

const OPEN_EYE = "M 2 26 C 12 10, 40 10, 50 26 C 40 42, 12 42, 2 26 Z";
const CLOSED_EYE = "M 4 20 C 14 29, 38 29, 48 20";
const CLOSED_LASHES = "M 14 25.5 L 11.5 30 M 26 26.8 L 26 31.5 M 38 25.5 L 40.5 30";

type EyeLogoProps = {
  className?: string;
  height?: number | string;
  /** `closed` is a resting eye with lashes: used where the app has nothing to show. */
  variant?: "closed" | "open";
  width?: number | string;
};

export function EyeLogo({
  className = styles.eyeLogo,
  height = 24,
  variant = "open",
  width = 24,
}: EyeLogoProps) {
  if (variant === "closed") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        height={height}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 52 52"
        width={width}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d={CLOSED_EYE} strokeWidth="2.8" />
        <path d={CLOSED_LASHES} strokeWidth="2.2" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 52 52"
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        className={styles.eyeShape}
        d={OPEN_EYE}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <circle
        className={styles.eyeIris}
        cx="26"
        cy="26"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <g className={styles.eyePupilG}>
        <circle className={styles.eyePupil} cx="26" cy="26" r="3.5" fill="currentColor" />
      </g>
    </svg>
  );
}
