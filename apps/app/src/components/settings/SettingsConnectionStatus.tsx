type SettingsConnectionStatusProps = {
  detail?: string;
  kind: "idle" | "success" | "error";
  label: string;
};

export function SettingsConnectionStatus({ detail, kind, label }: SettingsConnectionStatusProps) {
  return (
    <div className={`settings-connection-status ${kind}`}>
      <span className="status-dot" />
      {label}
      {detail ? <span className="status-detail">{detail}</span> : null}
    </div>
  );
}
