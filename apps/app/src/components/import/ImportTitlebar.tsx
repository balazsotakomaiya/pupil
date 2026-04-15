import { BackIcon } from "../ai-generate/AiGenerateIcons";
import { EyeLogo } from "../dashboard/EyeLogo";

type ImportTitlebarProps = {
  backLabel: string;
  onBack: () => void;
};

export function ImportTitlebar({ backLabel, onBack }: ImportTitlebarProps) {
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
          {backLabel}
        </button>

        <div className="titlebar-sep" />

        <span className="breadcrumb-name">Import</span>
      </div>

      <div className="titlebar-right" />
    </div>
  );
}
