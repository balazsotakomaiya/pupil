import styles from "./EyeLogo.module.css";

type EyeLogoProps = {
  className?: string;
  height?: number | string;
  width?: number | string;
};

export function EyeLogo({ className = styles.eyeLogo, height = 24, width = 24 }: EyeLogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 52 52"
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        className={styles.eyeShape}
        d="M 2 26 C 12 10, 40 10, 50 26 C 40 42, 12 42, 2 26 Z"
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
