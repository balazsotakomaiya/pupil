import { EyeLogo } from "../dashboard/EyeLogo";

type SpaceDetailsTitlebarProps = {
  onBack: () => void;
  onOpenAiGenerate: () => void;
  onOpenNewCard: () => void;
  spaceName: string;
};

export function SpaceDetailsTitlebar({
  onBack,
  onOpenAiGenerate,
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
        <button className="titlebar-btn-label" onClick={onOpenAiGenerate} type="button">
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
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4">
      <path d="M8 1.75l.8 2.6a1 1 0 00.67.67l2.6.8-2.6.8a1 1 0 00-.67.67L8 10.9l-.8-2.61a1 1 0 00-.67-.67l-2.6-.8 2.6-.8a1 1 0 00.67-.67L8 1.75z" />
      <path d="M12.75 9.75l.39 1.29a.7.7 0 00.47.47l1.29.39-1.29.39a.7.7 0 00-.47.47l-.39 1.29-.39-1.29a.7.7 0 00-.47-.47l-1.29-.39 1.29-.39a.7.7 0 00.47-.47l.39-1.29z" />
      <path d="M3 10.75l.3.99a.6.6 0 00.4.4l.99.3-.99.3a.6.6 0 00-.4.4L3 14.13l-.3-.99a.6.6 0 00-.4-.4l-.99-.3.99-.3a.6.6 0 00.4-.4l.3-.99z" />
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
