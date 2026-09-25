import { cx } from "../lib/cx";
import styles from "./PupilEye.module.css";

export default function PupilEye({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={cx(styles.eye, className)}
      width={size}
      height={size}
      viewBox="0 0 52 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        className={styles.shape}
        d="M3 26 C7 17 15 13 26 13 C37 13 45 17 49 26 C45 35 37 39 26 39 C15 39 7 35 3 26Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <circle
        className={styles.iris}
        cx="26"
        cy="26"
        r="8"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <g className={styles.pupilGroup}>
        <circle className={styles.pupil} cx="26" cy="26" r="4" fill="currentColor" />
      </g>
    </svg>
  );
}
