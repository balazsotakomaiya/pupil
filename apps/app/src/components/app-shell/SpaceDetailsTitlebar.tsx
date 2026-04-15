import { useEffect, useRef, useState } from "react";
import { EyeLogo } from "../dashboard/EyeLogo";

type SpaceDetailsTitlebarProps = {
  onBack: () => void;
  onOpenDeleteDialog: () => void;
  onOpenAiGenerate: () => void;
  onOpenImport: () => void;
  onOpenNewCard: () => void;
  spaceName: string;
};

export function SpaceDetailsTitlebar({
  onBack,
  onOpenDeleteDialog,
  onOpenAiGenerate,
  onOpenImport,
  onOpenNewCard,
  spaceName,
}: SpaceDetailsTitlebarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

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
        <button className="titlebar-btn-label" onClick={onOpenImport} type="button">
          <ImportIcon />
          Import
        </button>
        <div className="more-menu-wrap" ref={menuRef}>
          <button
            aria-expanded={isMenuOpen}
            aria-label="More actions"
            className={`titlebar-btn${isMenuOpen ? " active" : ""}`}
            onClick={() => setIsMenuOpen((open) => !open)}
            type="button"
          >
            <MoreIcon />
          </button>
          {isMenuOpen && (
            <div className="more-menu">
              <button
                className="more-menu-item danger"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenDeleteDialog();
                }}
                type="button"
              >
                <TrashIcon />
                Delete space
              </button>
            </div>
          )}
        </div>
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

function ImportIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5">
      <path d="M8 2.25v7" />
      <path d="M5.25 6.75L8 9.5l2.75-2.75" />
      <path d="M3 10.75v1A1.25 1.25 0 004.25 13h7.5A1.25 1.25 0 0013 11.75v-1" />
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

function TrashIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M2 3h8M4.5 3V2h3v1M3 3v7.5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V3" />
    </svg>
  );
}
