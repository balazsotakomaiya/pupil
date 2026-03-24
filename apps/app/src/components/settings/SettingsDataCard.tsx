import type { ReactNode } from "react";

type SettingsDataCardProps = {
  action: ReactNode;
  description: ReactNode;
  title: string;
  tone?: "default" | "danger";
  value?: ReactNode;
};

export function SettingsDataCard({
  action,
  description,
  title,
  tone = "default",
  value,
}: SettingsDataCardProps) {
  return (
    <div className={`settings-data-card${tone === "danger" ? " danger" : ""}`}>
      <div className="settings-data-card-left">
        <div className="settings-data-card-title">{title}</div>
        <div className="settings-data-card-desc">{description}</div>
      </div>

      <div className="settings-data-card-right">
        {value ? <span className="settings-data-card-value">{value}</span> : null}
        {action}
      </div>
    </div>
  );
}
