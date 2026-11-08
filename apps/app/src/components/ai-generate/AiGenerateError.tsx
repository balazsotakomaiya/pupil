import type { AiConnectionReason } from "../../lib/errors";
import { AlertIcon } from "../icons/AiGenerateIcons";
import styles from "./AiGenerate.module.css";

type AiGenerateErrorProps = {
  detail: string;
  onEditPrompt: () => void;
  onOpenSettings: () => void;
  onRetry: () => void;
  /** Set when the failure was the connection itself rather than the run. */
  reason: AiConnectionReason | null;
};

const CONNECTION_TITLES: Partial<Record<AiConnectionReason, string>> = {
  usageLimit: "Usage limit reached",
  expired: "Reconnect to continue",
  signedOut: "Connect AI to continue",
  declined: "Plan usage is off",
  notEligible: "Plan usage unavailable",
  notInstalled: "Claude Code not found",
  apiBilling: "Not using a Claude plan",
  modelUnavailable: "Model unavailable",
  timeout: "The AI took too long",
};

const SETTINGS_REASONS: ReadonlySet<AiConnectionReason> = new Set([
  "expired",
  "signedOut",
  "declined",
  "notEligible",
  "notInstalled",
  "apiBilling",
  "modelUnavailable",
]);

export function AiGenerateError({
  detail,
  onEditPrompt,
  onOpenSettings,
  onRetry,
  reason,
}: AiGenerateErrorProps) {
  const title = (reason && CONNECTION_TITLES[reason]) ?? "Generation failed";
  const needsSettings = reason !== null && SETTINGS_REASONS.has(reason);
  return (
    <div className={styles.aiGenStateView}>
      <div className={styles.aiGenErrorSection}>
        <div className={styles.aiGenErrorIcon}>
          <AlertIcon />
        </div>
        <div className={styles.aiGenErrorTitle}>{title}</div>
        <div className={styles.aiGenErrorDesc}>
          {reason
            ? "Nothing was charged to another account. Pupil only uses the connection you chose."
            : "The AI run did not complete. Check the prompt or provider settings and try again."}
        </div>
        <div className={styles.aiGenErrorDetail}>{detail}</div>
        <div className={styles.aiGenErrorActions}>
          <button className={styles.aiGenErrorBtn} onClick={onEditPrompt} type="button">
            Edit prompt
          </button>
          {needsSettings ? (
            <button
              className={`${styles.aiGenErrorBtn} ${styles.primary}`}
              onClick={onOpenSettings}
              type="button"
            >
              Open Settings
            </button>
          ) : (
            <button
              className={`${styles.aiGenErrorBtn} ${styles.primary}`}
              onClick={onRetry}
              type="button"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
