import { EyeLogo } from "../dashboard/EyeLogo";
import { BackIcon } from "./AiGenerateIcons";

type AiGenerateTitlebarProps = {
  backLabel: string;
  onBack: () => void;
};

export function AiGenerateTitlebar({ backLabel, onBack }: AiGenerateTitlebarProps) {
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

        <span className="breadcrumb-name">AI Generate</span>
      </div>

      <div className="titlebar-right" />
    </div>
  );
}
