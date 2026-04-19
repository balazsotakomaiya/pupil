import { EyeLogo } from "../dashboard/EyeLogo";
import { AiGenerateIcon, CreateSpaceIcon, ImportDeckIcon } from "./OnboardingIcons";
import { OnboardingPathCard } from "./OnboardingPathCard";
import { OnboardingQuickStart } from "./OnboardingQuickStart";

type OnboardingScreenProps = {
  onCreateSpace: () => void;
  onGenerateWithAi: () => void;
  onImport: () => void;
  onOpenSettings: () => void;
  onSkip: () => void;
};

export function OnboardingScreen({
  onCreateSpace,
  onGenerateWithAi,
  onImport,
  onOpenSettings,
  onSkip,
}: OnboardingScreenProps) {
  return (
    <>
      <div className="welcome-titlebar" />

      <div className="welcome-page">
        <div className="welcome-hero">
          <div className="welcome-hero-eye">
            <EyeLogo className="welcome-eye-logo" height={64} width={64} />
          </div>

          <div className="welcome-hero-wordmark">pupil</div>

          <p className="welcome-hero-desc">
            Local-first flashcards with spaced repetition and AI generation. Everything stays on
            your machine. Pick a starting point below.
          </p>
        </div>

        <div className="welcome-paths-section">
          <div className="welcome-paths-label">Get started</div>

          <div className="welcome-paths-grid">
            <OnboardingPathCard
              ctaLabel="Create"
              description="Start from scratch. Name a topic and add cards manually, one at a time."
              icon={<CreateSpaceIcon />}
              onClick={onCreateSpace}
              title="Create a space"
            />

            <OnboardingPathCard
              ctaLabel="Import"
              description={
                <>
                  Drop an <code>.apkg</code> file. Your decks become spaces, cards get fresh FSRS
                  scheduling.
                </>
              }
              icon={<ImportDeckIcon />}
              onClick={onImport}
              title="Import from Anki"
            />

            <OnboardingPathCard
              badge="Fastest"
              ctaLabel="Generate"
              description="Give a topic and difficulty. Pupil will generate a deck in seconds once AI generation is enabled."
              icon={<AiGenerateIcon />}
              onClick={onGenerateWithAi}
              title="Generate with AI"
            />
          </div>
        </div>

        <div className="welcome-or-row">
          <div className="welcome-or-line" />
          <span className="welcome-or-text">or skip ahead</span>
          <div className="welcome-or-line" />
        </div>

        <div className="welcome-quickstart">
          <OnboardingQuickStart onClick={onSkip} />
        </div>

        <div className="welcome-bottom">
          <p className="welcome-api-hint">
            AI generation requires an API key from Anthropic, OpenAI, or any compatible provider.
            You can add one later in{" "}
            <button className="welcome-inline-link" onClick={onOpenSettings} type="button">
              Settings
            </button>
            . Everything else works without it.
          </p>
        </div>
      </div>
    </>
  );
}
