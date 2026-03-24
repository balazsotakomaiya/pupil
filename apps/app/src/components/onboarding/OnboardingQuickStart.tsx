import { ChevronRightIcon, ExploreAppIcon } from "./OnboardingIcons";

type OnboardingQuickStartProps = {
  onClick: () => void;
};

export function OnboardingQuickStart({ onClick }: OnboardingQuickStartProps) {
  return (
    <button className="welcome-quickstart-card" onClick={onClick} type="button">
      <div className="welcome-quickstart-left">
        <div className="welcome-quickstart-icon">
          <ExploreAppIcon />
        </div>
        <div className="welcome-quickstart-text">
          <div className="welcome-quickstart-title">Just explore the app</div>
          <div className="welcome-quickstart-desc">
            Skip setup and head to the dashboard. You can create spaces, import, or generate cards
            later.
          </div>
        </div>
      </div>
      <div className="welcome-quickstart-arrow">
        <ChevronRightIcon />
      </div>
    </button>
  );
}
