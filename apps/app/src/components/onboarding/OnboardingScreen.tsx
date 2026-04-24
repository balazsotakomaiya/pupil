import { EyeLogo } from "../dashboard/EyeLogo";
import styles from "./Onboarding.module.css";
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
      <div className={styles.welcomeTitlebar} />

      <div className={styles.welcomePage}>
        <div className={styles.welcomeHero}>
          <div className={styles.welcomeHeroEye}>
            <EyeLogo className={styles.welcomeEyeLogo} height={64} width={64} />
          </div>

          <div className={styles.welcomeHeroWordmark}>pupil</div>

          <p className={styles.welcomeHeroDesc}>
            Local-first flashcards with spaced repetition and AI generation. Everything stays on
            your machine. Pick a starting point below.
          </p>
        </div>

        <div className={styles.welcomePathsSection}>
          <div className={styles.welcomePathsLabel}>Get started</div>

          <div className={styles.welcomePathsGrid}>
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

        <div className={styles.welcomeOrRow}>
          <div className={styles.welcomeOrLine} />
          <span className={styles.welcomeOrText}>or skip ahead</span>
          <div className={styles.welcomeOrLine} />
        </div>

        <div className={styles.welcomeQuickstart}>
          <OnboardingQuickStart onClick={onSkip} />
        </div>

        <div className={styles.welcomeBottom}>
          <p className={styles.welcomeApiHint}>
            AI generation requires an API key from Anthropic, OpenAI, or any compatible provider.
            You can add one later in{" "}
            <button className={styles.welcomeInlineLink} onClick={onOpenSettings} type="button">
              Settings
            </button>
            . Everything else works without it.
          </p>
        </div>
      </div>
    </>
  );
}
