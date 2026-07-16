import { lazy, Suspense } from "react";
import type { ExplainCardPayload } from "../../lib/ai-explanation";
import styles from "./Study.module.css";

const StudyExplainVisual = lazy(() =>
  import("./StudyExplainVisual").then((module) => ({ default: module.StudyExplainVisual })),
);

type StudyExplainContentProps = {
  isVisualExpanded: boolean;
  onToggleVisualExpanded: () => void;
  payload: ExplainCardPayload;
};

export function StudyExplainContent({
  isVisualExpanded,
  onToggleVisualExpanded,
  payload,
}: StudyExplainContentProps) {
  return (
    <div className={styles.sessionExplainText}>
      {payload.paragraphs.map((paragraph, index) => (
        <p key={`para-${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>
      ))}
      {payload.visual ? (
        <Suspense
          fallback={<div className={styles.sessionExplainVisualLoading}>Loading visual aid…</div>}
        >
          <StudyExplainVisual
            isExpanded={isVisualExpanded}
            onToggleExpanded={onToggleVisualExpanded}
            visual={payload.visual}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
