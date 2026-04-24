import styles from "./Import.module.css";
import { FileIcon } from "./ImportIcons";
import type { ImportProgressModel } from "./types";

type ImportProgressCardProps = {
  model: ImportProgressModel;
};

export function ImportProgressCard({ model }: ImportProgressCardProps) {
  return (
    <div className={styles.importProgressCard}>
      <div className={styles.importProgressTop}>
        <div className={styles.importFileInfo}>
          <div className={styles.importFileIcon}>
            <FileIcon />
          </div>
          <div>
            <div className={styles.importFileName}>{model.fileName}</div>
            <div className={styles.importFileSize}>{model.fileSubtext}</div>
          </div>
        </div>
        <span className={`${styles.importStatusBadge} ${styles[model.statusVariant]}`}>
          {model.statusLabel}
        </span>
      </div>

      <div className={styles.progressBarWrap}>
        <div
          className={`${styles.progressBar}${model.statusVariant === "complete" ? ` ${styles.done}` : ""}`}
          style={{ width: `${model.progress}%` }}
        />
      </div>

      <div className={styles.importProgressDetails}>
        {model.details.map((detail) => (
          <span className={styles.importDetail} key={`${detail.label}-${detail.value}`}>
            <strong className={detail.accent === "success" ? styles.valSuccess : undefined}>
              {detail.value}
            </strong>{" "}
            {detail.label}
          </span>
        ))}
      </div>
    </div>
  );
}
