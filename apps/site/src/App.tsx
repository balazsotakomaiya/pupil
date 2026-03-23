export default function App() {
  return (
    <>
      {/* Ruler overlay */}
      <div className="rulers" aria-hidden="true">
        <div className="ruler ruler-v ruler-outer-left" />
        <div className="ruler ruler-v ruler-outer-right" />
        <div className="ruler ruler-v ruler-content-left" />
        <div className="ruler ruler-v ruler-content-right" />
        <div className="ruler ruler-h ruler-top" />
        <div className="ruler ruler-h ruler-bottom" />
      </div>

      {/* Nav */}
      <nav className="nav">
        <div className="nav-inner">
          <a href="/" className="nav-logo">
            <PupilEye />
            pupil
          </a>
          <ul className="nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">How it works</a></li>
            <li>
              <a
                href="https://github.com/pupil-app/pupil"
                className="nav-github"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </li>
          </ul>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-badge">
          <span className="hero-badge-chip">v0.1</span>
          Open source · Local-first · FSRS-5
        </div>
        <h1 className="hero-title">
          Flashcards that <em>actually</em> work with your brain
        </h1>
        <p className="hero-desc">
          Pupil generates, organizes, and adapts cards to your knowledge gaps
          using AI and science-backed spaced repetition. No account needed.
        </p>
        <div className="hero-ctas">
          <a href="#" className="btn-primary">
            Download for Mac
          </a>
          <a href="#" className="btn-secondary">
            Open Web App
          </a>
        </div>
      </section>

      <div className="ruler-divider" />

      {/* Features */}
      <section className="section" id="features">
        <p className="section-label">Features</p>
        <h2 className="section-title">Everything Anki should have been</h2>
        <p className="section-desc">
          All the rigor of spaced repetition. None of the friction. Powered
          by AI so you can go from topic to drill in seconds.
        </p>
        <div className="features-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <p className="feature-title">{f.title}</p>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="ruler-divider" />

      {/* Footer */}
      <footer className="footer">
        <a href="/" className="footer-logo">pupil</a>
        <nav className="footer-links">
          <a href="https://github.com/pupil-app/pupil" target="_blank" rel="noopener noreferrer">GitHub</a>
          <span className="sep">·</span>
          <a href="/docs">Docs</a>
          <span className="sep">·</span>
          <a href="https://github.com/pupil-app/pupil/issues" target="_blank" rel="noopener noreferrer">Issues</a>
        </nav>
        <a
          href="https://github.com/pupil-app/pupil"
          className="footer-credit"
          target="_blank"
          rel="noopener noreferrer"
        >
          open source
        </a>
      </footer>
    </>
  );
}

/* ─── Animated eye logo ─────────────────────────────────────────────────── */
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
          25%   { transform: translateX(3.5px); }
          75%   { transform: translateX(-3.5px); }
          100%  { transform: translateX(0); }
        }
      `}</style>

      {/* Eye outline */}
      <path
        className="pupil-eye-shape"
        d="M4 26 C4 26 13 10 26 10 C39 10 48 26 48 26 C48 26 39 42 26 42 C13 42 4 26 4 26Z"
        stroke="#ededed"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Iris */}
      <circle className="pupil-eye-iris" cx="26" cy="26" r="9" stroke="#ededed" strokeWidth="1.5" fill="none" />
      {/* Pupil group */}
      <g className="pupil-eye-pupil-group">
        {/* Pupil fill with look animation */}
        <circle className="pupil-eye-pupil" cx="26" cy="26" r="4" fill="#ededed" />
      </g>
    </svg>
  );
}

/* ─── Feature data ──────────────────────────────────────────────────────── */
const FEATURES = [
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
    desc: "Organize cards into named spaces like \"Systems Design\" or \"Biology\". Study globally or drill a single space.",
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
];

/* ─── Icon components (inline SVG) ─────────────────────────────────────── */
function SparklesIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75L19 15z" />
      <path d="M5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5L5 17z" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.78-3.27A3 3 0 0 1 3 13.5a3 3 0 0 1 2-2.83V10a2.5 2.5 0 0 1 4.5-1.5" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.78-3.27A3 3 0 0 0 21 13.5a3 3 0 0 0-2-2.83V10a2.5 2.5 0 0 0-4.5-1.5" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
