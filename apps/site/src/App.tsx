import { Link } from "react-router-dom";
import appPackage from "../../app/package.json";
import Nav from "./Nav";

const RELEASES_URL = "https://github.com/balazsotakomaiya/pupil/releases";
const DESKTOP_APP_VERSION = appPackage.version;

type OS = "mac" | "windows" | "linux" | "unknown";

function detectOS(): OS {
  const ua = navigator.userAgent;
  if (/Macintosh|MacIntel/.test(ua)) return "mac";
  if (/Windows/.test(ua)) return "windows";
  if (/Linux/.test(ua) && !/Android/.test(ua)) return "linux";
  return "unknown";
}

const OS_CONFIG: Record<OS, { label: string; icon: React.ReactNode }> = {
  mac:     { label: "Download for Mac",     icon: <AppleIcon /> },
  windows: { label: "Download for Windows", icon: <WindowsIcon /> },
  linux:   { label: "Download for Linux",   icon: <LinuxIcon /> },
  unknown: { label: "Download",             icon: <DownloadIcon /> },
};

function DownloadCTA() {
  const { label, icon } = OS_CONFIG[detectOS()];
  return (
    <div className="hero-ctas-group">
      <div className="hero-ctas">
        <a href={RELEASES_URL} className="btn-primary" target="_blank" rel="noopener noreferrer">
          {icon}
          {label}
        </a>
        <a href="#" className="btn-secondary">
          Open Web App
        </a>
      </div>
      <a href={RELEASES_URL} className="btn-all-platforms" target="_blank" rel="noopener noreferrer">
        All platforms ↗
      </a>
    </div>
  );
}

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

      <Nav />

      {/* Hero */}
      <section className="hero">
        <div className="hero-badge">
          <span className="hero-badge-chip">v{DESKTOP_APP_VERSION}</span>
          Open source · Local-first · FSRS-5
        </div>
        <h1 className="hero-title">
          Flashcards that <em>actually</em> work with your brain
        </h1>
        <p className="hero-desc">
          Pupil generates, organizes, and adapts cards to your knowledge gaps
          using AI and science-backed spaced repetition. No account needed.
        </p>
        <DownloadCTA />

        {/* App screenshot slot */}
        <div className="hero-mockup">
          <AppMockup />
        </div>
      </section>

      <div className="ruler-divider" />

      {/* Features */}
      <section className="section" id="features">
        <p className="section-label">Features</p>
        <h2 className="section-title">Spaced repetition, without the friction</h2>
        <p className="section-desc">
          All the rigor of the algorithm. None of the setup. Powered by AI
          so you can go from topic to drill in seconds.
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

      {/* How it works */}
      <section className="section" id="how-it-works">
        <p className="section-label">How it works</p>
        <h2 className="section-title">From topic to retained in minutes</h2>
        <p className="section-desc">
          No setup, no configuration. Just tell Pupil what you want to learn.
        </p>
        <div className="steps">
          {STEPS.map((step, i) => (
            <div className="step" key={step.title}>
              <div className="step-number">
                <span>{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className="step-connector" aria-hidden="true" />
              <p className="step-title">{step.title}</p>
              <p className="step-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="ruler-divider" />

      {/* Final CTA */}
      <section className="cta-section">
        <p className="section-label">Get started</p>
        <h2 className="cta-title">
          Ready to <em>actually</em> remember things?
        </h2>
        <p className="cta-desc">
          Free. Open source. No account. Your cards stay on your device.
        </p>
        <DownloadCTA />
      </section>

      <div className="ruler-divider" />

      {/* Footer */}
      <footer className="footer">
        <Link to="/" className="footer-logo">pupil</Link>
        <nav className="footer-links">
          <a href="https://github.com/balazsotakomaiya/pupil" target="_blank" rel="noopener noreferrer">GitHub</a>
          <span className="sep">·</span>
          <a href="/docs">Docs</a>
          <span className="sep">·</span>
          <a href="https://github.com/balazsotakomaiya/pupil/issues" target="_blank" rel="noopener noreferrer">Issues</a>
        </nav>
        <a
          href="https://otakomaiya.com"
          className="footer-credit"
          target="_blank"
          rel="noopener noreferrer"
        >
          Balazs Otakomaiya
        </a>
      </footer>
    </>
  );
}

/* ─── App mockup (screenshot placeholder) ───────────────────────────────── */
function AppMockup() {
  return (
    <div className="mockup-window">
      <div className="mockup-titlebar">
        <div className="mockup-dots">
          <span className="dot dot-red" />
          <span className="dot dot-yellow" />
          <span className="dot dot-green" />
        </div>
        <span className="mockup-app-title">pupil</span>
      </div>
      <div className="mockup-body">
        <aside className="mockup-sidebar">
          <div className="mockup-tab mockup-tab-active">Dashboard</div>
          <div className="mockup-tab">Cards</div>
          <div className="mockup-tab">Study</div>
          <div className="mockup-tab">AI Generate</div>
          <div className="mockup-tab">Import</div>
          <div className="mockup-sidebar-spacer" />
          <div className="mockup-tab">Settings</div>
        </aside>
        <main className="mockup-main">
          <div className="mockup-main-header">
            <span className="mockup-greeting">Good morning</span>
            <div className="mockup-btn">Study all</div>
          </div>
          <div className="mockup-stats-row">
            {[
              { value: "142", label: "Total cards" },
              { value: "14",  label: "Due today" },
              { value: "91%", label: "Retention" },
              { value: "7d",  label: "Streak" },
            ].map((s) => (
              <div className="mockup-stat" key={s.label}>
                <span className="mockup-stat-value">{s.value}</span>
                <span className="mockup-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
          <p className="mockup-section-label">Spaces</p>
          <div className="mockup-spaces">
            {[
              { name: "Systems Design", cards: 43, due: 3 },
              { name: "Biology",        cards: 28, due: 8 },
              { name: "Spanish vocab",  cards: 71, due: 1 },
            ].map((sp) => (
              <div className="mockup-space-row" key={sp.name}>
                <div className="mockup-space-icon" />
                <span className="mockup-space-name">{sp.name}</span>
                <span className="mockup-space-meta">{sp.cards} cards</span>
                <span className="mockup-space-due">{sp.due} due</span>
                <div className="mockup-study-btn">Study</div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ─── How it works data ─────────────────────────────────────────────────── */
const STEPS = [
  {
    title: "Generate",
    desc: "Type any topic. Pick a difficulty and card style. Pupil's AI drafts a full deck in seconds — from scratch.",
  },
  {
    title: "Review",
    desc: "Approve, edit, or discard cards before they land in your space. You decide what's worth learning.",
  },
  {
    title: "Retain",
    desc: "FSRS-5 schedules each card at exactly the right moment. Study less time, remember far more.",
  },
];

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
  {
    title: "Command palette",
    desc: "Jump to any space, start a study session, or generate cards — all from the keyboard. No mouse required.",
    icon: <CommandIcon />,
  },
  {
    title: "Tiny footprint",
    desc: "Under 10 MB to download. Launches in under a second. Won't hog your RAM while you're doing real work.",
    icon: <FeatherIcon />,
  },
];

/* ─── Icon components (inline SVG) ─────────────────────────────────────── */
function AppleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

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

function CommandIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
    </svg>
  );
}

function FeatherIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
      <line x1="16" y1="8" x2="2" y2="22" />
      <line x1="17.5" y1="15" x2="9" y2="15" />
    </svg>
  );
}

function WindowsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4zM11.4 24H0V12.6h11.4V24zm12.6 0H12.6V12.6H24V24z" />
    </svg>
  );
}

function LinuxIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
