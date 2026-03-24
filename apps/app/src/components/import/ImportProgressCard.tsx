import { FileIcon } from "./ImportIcons";
import type { ImportProgressModel } from "./types";

type ImportProgressCardProps = {
  model: ImportProgressModel;
};

export function ImportProgressCard({ model }: ImportProgressCardProps) {
  return (
    <div className="import-progress-card">
      <div className="import-progress-top">
        <div className="import-file-info">
          <div className="import-file-icon">
            <FileIcon />
          </div>
          <div>
            <div className="import-file-name">{model.fileName}</div>
            <div className="import-file-size">{model.fileSubtext}</div>
          </div>
        </div>
        <span className={`import-status-badge ${model.statusVariant}`}>{model.statusLabel}</span>
      </div>

      <div className="progress-bar-wrap">
        <div
          className={`progress-bar${model.statusVariant === "complete" ? " done" : ""}`}
          style={{ width: `${model.progress}%` }}
        />
      </div>

      <div className="import-progress-details">
        {model.details.map((detail) => (
          <span className="import-detail" key={`${detail.label}-${detail.value}`}>
            <strong className={detail.accent === "success" ? "val-success" : undefined}>
              {detail.value}
            </strong>{" "}
            {detail.label}
          </span>
        ))}
      </div>
    </div>
  );
}
