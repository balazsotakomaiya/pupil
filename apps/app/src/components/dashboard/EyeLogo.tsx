export function EyeLogo() {
  return (
    <svg
      className="eye-logo"
      viewBox="0 0 52 52"
      width="24"
      height="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        className="eye-shape"
        d="M 2 26 C 12 10, 40 10, 50 26 C 40 42, 12 42, 2 26 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <circle
        className="eye-iris"
        cx="26"
        cy="26"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <g className="eye-pupil-g">
        <circle className="eye-pupil" cx="26" cy="26" r="3.5" fill="currentColor" />
      </g>
    </svg>
  );
}
