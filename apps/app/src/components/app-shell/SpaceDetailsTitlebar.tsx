import { EyeLogo } from "../dashboard/EyeLogo";

type SpaceDetailsTitlebarProps = {
  onBack: () => void;
  onOpenNewCard: () => void;
  spaceName: string;
};

export function SpaceDetailsTitlebar({
  onBack,
  onOpenNewCard,
  spaceName,
}: SpaceDetailsTitlebarProps) {
  return (
    <div className="titlebar">
      <div className="titlebar-left">
        <div className="titlebar-logo">
          <EyeLogo />
          <span className="titlebar-logo-text">pupil</span>
        </div>

        <div className="titlebar-sep" />

        <button className="back-btn" onClick={onBack} type="button">
          <BackIcon />
          Dashboard
        </button>

        <div className="titlebar-sep" />

        <span className="breadcrumb-name">{spaceName}</span>
      </div>

      <div className="titlebar-right">
        <button className="titlebar-btn-label" onClick={onOpenNewCard} type="button">
          <PlusIcon />
          New Card
        </button>
        <button className="titlebar-btn-label" type="button">
          <GenerateIcon />
          AI Generate
        </button>
        <button aria-label="More actions" className="titlebar-btn" type="button">
          <MoreIcon />
        </button>
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 3L5 8l5 5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 2v10M2 7h10" />
    </svg>
  );
}

function GenerateIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11.5 7.5L7 12l-4.5-4.5M7 12V2" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="3.5" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="8" cy="12.5" r="1.5" />
    </svg>
  );
}
