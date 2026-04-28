import { Link, useLocation } from "react-router-dom";

export default function Nav() {
  const { pathname } = useLocation();

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-logo">
          <PupilEye />
          pupil
        </Link>
        <ul className="nav-links">
          <li>
            <a href="/#screenshots">App</a>
          </li>
          <li>
            <a href="/#features">Features</a>
          </li>
          <li>
            <a href="/#how-it-works">How it works</a>
          </li>
          <li>
            <Link
              to="/manifesto"
              className={pathname === "/manifesto" ? "nav-link-active" : undefined}
            >
              Manifesto
            </Link>
          </li>
          <li>
            <a
              href="https://github.com/balazsotakomaiya/pupil"
              className="nav-github"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              GitHub
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}

function PupilEye() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 52 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <style>{`
        .pupil-eye-shape {
          animation: pupil-blink 4s ease-in-out infinite;
          transform-origin: 26px 26px;
        }
        .pupil-eye-iris {
          animation: pupil-iris 4s ease-in-out infinite;
          transform-origin: 26px 26px;
        }
        .pupil-eye-pupil-group {
          animation: pupil-hide 4s ease-in-out infinite;
          transform-origin: 26px 26px;
        }
        .pupil-eye-pupil {
          animation: pupil-look 4s ease-in-out infinite;
          transform-origin: 26px 26px;
        }
        @keyframes pupil-blink {
          0%, 17%, 22%, 100%  { transform: scaleY(1); }
          18.5%               { transform: scaleY(0.05); }
          20%                 { transform: scaleY(1); }
        }
        @keyframes pupil-iris {
          0%, 17%, 22%, 100%  { transform: scaleY(1); }
          18.5%               { transform: scaleY(0.1); }
          20%                 { transform: scaleY(1); }
        }
        @keyframes pupil-hide {
          0%, 17%, 22%, 100%  { opacity: 1; }
          18.5%               { opacity: 0; }
          20%                 { opacity: 1; }
        }
        @keyframes pupil-look {
          0%    { transform: translateX(0); }
          25%   { transform: translateX(2px); }
          75%   { transform: translateX(-2px); }
          100%  { transform: translateX(0); }
        }
      `}</style>

      <path
        className="pupil-eye-shape"
        d="M3 26 C7 17 15 13 26 13 C37 13 45 17 49 26 C45 35 37 39 26 39 C15 39 7 35 3 26Z"
        stroke="#ededed"
        strokeWidth="1.5"
        fill="none"
      />
      <circle
        className="pupil-eye-iris"
        cx="26"
        cy="26"
        r="8"
        stroke="#ededed"
        strokeWidth="1.5"
        fill="none"
      />
      <g className="pupil-eye-pupil-group">
        <circle className="pupil-eye-pupil" cx="26" cy="26" r="4" fill="#ededed" />
      </g>
    </svg>
  );
}
