import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import appPackage from "../../app/package.json";
import aiGenerateScreenshot from "./assets/screenshots/ai-generate.png";
import aiReviewScreenshot from "./assets/screenshots/ai-review.png";
import commandPaletteScreenshot from "./assets/screenshots/command-palette.png";
import dashboardScreenshot from "./assets/screenshots/dashboard.png";
import importScreenshot from "./assets/screenshots/import.png";
import spaceStatsScreenshot from "./assets/screenshots/space-stats.png";
import studyFrontScreenshot from "./assets/screenshots/study-front.png";
import studyReviewScreenshot from "./assets/screenshots/study-review.png";
import Nav from "./Nav";

const REPO_URL = "https://github.com/balazsotakomaiya/pupil";
const RELEASES_URL = `${REPO_URL}/releases`;
const DOCS_URL = `${REPO_URL}/wiki`;
const ISSUES_URL = `${REPO_URL}/issues`;
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
  mac: { label: "Download for Mac", icon: <AppleIcon /> },
  windows: { label: "Download for Windows", icon: <WindowsIcon /> },
  linux: { label: "Download for Linux", icon: <LinuxIcon /> },
  unknown: { label: "Download", icon: <DownloadIcon /> },
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
        <a href={REPO_URL} className="btn-secondary" target="_blank" rel="noopener noreferrer">
          Open GitHub
        </a>
      </div>
      <a
        href={RELEASES_URL}
        className="btn-all-platforms"
        target="_blank"
        rel="noopener noreferrer"
      >
        All platforms ↗
      </a>
    </div>
  );
}

export default function App() {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const openLightbox = (src: string, alt: string) => setLightbox({ src, alt });
  const closeLightbox = () => setLightbox(null);

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
          Pupil generates, organizes, and adapts cards to your knowledge gaps using AI and
          science-backed spaced repetition. No account needed.
        </p>
        <DownloadCTA />

        <div className="hero-mockup">
          <ScreenshotFrame
            src={dashboardScreenshot}
            alt="Pupil dashboard showing due cards, study stats, and learning spaces"
            priority
          />
        </div>
      </section>

      <div className="ruler-divider" />

      {/* Product tour */}
      <section className="section product-tour" id="screenshots">
        <p className="section-label">Inside the app</p>
        <h2 className="section-title">A closer look at Pupil</h2>
        <p className="section-desc">
          Generate a deck, approve the cards, study with FSRS, and see which spaces need attention.
        </p>
        <div className="screenshot-feature">
          <div className="screenshot-copy">
            <p className="screenshot-kicker">AI generation</p>
            <h3>Turn a topic into a reviewed deck</h3>
            <p>
              Pupil drafts cards from your prompt, then keeps you in the loop before anything is
              saved.
            </p>
          </div>
          <ScreenshotFrame
            src={aiGenerateScreenshot}
            alt="AI Generate screen with prompt, space, difficulty, style, and count controls"
            onOpen={openLightbox}
          />
        </div>
        <div className="screenshot-grid">
          {SCREENSHOTS.map((screenshot) => (
            <article className="screenshot-card" key={screenshot.title}>
              <ScreenshotFrame src={screenshot.src} alt={screenshot.alt} onOpen={openLightbox} />
              <div className="screenshot-card-copy">
                <p>{screenshot.title}</p>
                <span>{screenshot.caption}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="ruler-divider" />

      {/* Features */}
      <section className="section" id="features">
        <p className="section-label">Features</p>
        <h2 className="section-title">Spaced repetition, without the friction</h2>
        <p className="section-desc">
          All the rigor of the algorithm. None of the setup. Powered by AI so you can go from topic
          to drill in seconds.
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
        <p className="cta-desc">Free. Open source. No account. Your cards stay on your device.</p>
        <DownloadCTA />
      </section>

      <div className="ruler-divider" />

      {/* Footer */}
      <footer className="footer">
        <Link to="/" className="footer-logo">
          pupil
        </Link>
        <nav className="footer-links">
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <span className="sep">·</span>
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">
            Docs
          </a>
          <span className="sep">·</span>
          <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
            Issues
          </a>
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

      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={closeLightbox} />}
    </>
  );
}

type ScreenshotFrameProps = {
  src: string;
  alt: string;
  priority?: boolean;
  onOpen?: (src: string, alt: string) => void;
};

function ScreenshotFrame({ src, alt, priority = false, onOpen }: ScreenshotFrameProps) {
  const img = (
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
    />
  );

  if (!onOpen) {
    return <figure className="screenshot-frame screenshot-frame-static">{img}</figure>;
  }

  return (
    <button
      type="button"
      className="screenshot-frame"
      onClick={() => onOpen(src, alt)}
      aria-label={`Open screenshot: ${alt}`}
    >
      {img}
      <span className="screenshot-open-indicator" aria-hidden="true">
        <ArrowUpRightIcon />
      </span>
    </button>
  );
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <button
        type="button"
        className="lightbox-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
      >
        <CloseIcon />
      </button>
      <img className="lightbox-img" src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="8 7 17 7 17 16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
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

const SCREENSHOTS = [
  {
    title: "Approve every card",
    caption: "Pupil drafts the cards. You decide which ones make it into your deck.",
    src: aiReviewScreenshot,
    alt: "Reviewing AI-generated flashcards with discard and approve controls",
  },
  {
    title: "Answer reveal",
    caption: "Start with one clear prompt, then reveal only when you are ready.",
    src: studyFrontScreenshot,
    alt: "Study screen showing the front of a flashcard before revealing the answer",
  },
  {
    title: "Focused review",
    caption: "A quiet study view with answer reveal and FSRS rating choices.",
    src: studyReviewScreenshot,
    alt: "Study screen showing a revealed flashcard answer and FSRS rating buttons",
  },
  {
    title: "Space stats",
    caption: "Inspect card states, recent activity, and the cards inside each space.",
    src: spaceStatsScreenshot,
    alt: "Space detail screen showing review activity, card states, and recent cards",
  },
  {
    title: "Keyboard control",
    caption: "Open the command palette to study, generate, import, or jump around.",
    src: commandPaletteScreenshot,
    alt: "Command palette overlay listing actions and spaces",
  },
  {
    title: "Anki import",
    caption: "Bring existing .apkg decks into local spaces.",
    src: importScreenshot,
    alt: "Import screen for adding Anki .apkg files",
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
    desc: 'Organize cards into named spaces like "Systems Design" or "Biology". Study globally or drill a single space.',
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
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75L19 15z" />
      <path d="M5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5L5 17z" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.78-3.27A3 3 0 0 1 3 13.5a3 3 0 0 1 2-2.83V10a2.5 2.5 0 0 1 4.5-1.5" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.78-3.27A3 3 0 0 0 21 13.5a3 3 0 0 0-2-2.83V10a2.5 2.5 0 0 0-4.5-1.5" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function CommandIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
    </svg>
  );
}

function FeatherIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
