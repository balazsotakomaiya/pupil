import type { BootstrapState } from "../lib/bootstrap";
import type { DesignId } from "../layouts/types";

const DESIGNS: { id: DesignId; label: string }[] = [
  { id: "A", label: "A · Cards" },
  { id: "B", label: "B · Accent" },
  { id: "C", label: "C · Editorial" },
  { id: "D", label: "D · Stripped" },
  { id: "E", label: "E · Tonal" },
];

interface DebugBarProps {
  bootstrapState: BootstrapState | null;
  activeDesign: DesignId;
  onDesignChange: (id: DesignId) => void;
}

export function DebugBar({ bootstrapState, activeDesign, onDesignChange }: DebugBarProps) {
  return (
    <div className="debug-bar">
      <div className="debug-bar-info">
        <span className="debug-tag">dev</span>
        <span className="debug-item">{bootstrapState?.mode ?? "..."}</span>
        <span className="debug-sep">·</span>
        <span className="debug-item">
          {bootstrapState?.appliedMigrations.length ?? 0} migrations applied
        </span>
        {bootstrapState?.databasePath ? (
          <>
            <span className="debug-sep">·</span>
            <span className="debug-item debug-path" title={bootstrapState.databasePath}>
              {truncatePath(bootstrapState.databasePath)}
            </span>
          </>
        ) : null}
      </div>
      <div className="debug-bar-designs">
        {DESIGNS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`debug-design-btn${activeDesign === id ? " active" : ""}`}
            onClick={() => onDesignChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function truncatePath(path: string): string {
  const parts = path.split(/[/\\]/);
  if (parts.length <= 3) return path;
  return `…/${parts.slice(-2).join("/")}`;
}
