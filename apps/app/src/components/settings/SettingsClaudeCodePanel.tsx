import { useEffect, useRef, useState } from "react";
import {
  CLAUDE_CODE_LOGIN_COMMAND,
  CLAUDE_CODE_SETUP_URL,
  type ClaudeCodeStatus,
  getClaudeCodeStatus,
} from "../../lib/ai-connections";
import { CLAUDE_CODE_MODELS, describeAiSettingsError } from "../../lib/ai-settings";
import { CopyIcon } from "../icons/SettingsIcons";
import styles from "./SettingsAiConnection.module.css";
import { SettingsConnectionStatus } from "./SettingsConnectionStatus";

type Props = {
  disabled: boolean;
  model: string;
  onModelChange: (model: string) => void;
  onOpenUrl: (url: string) => void;
  onPathChange: (path: string) => void;
  /** Called after each status check so the AI gates match what was found. */
  onReadyChange: (ready: boolean) => void;
  path: string;
};

export function SettingsClaudeCodePanel({
  disabled,
  model,
  onModelChange,
  onOpenUrl,
  onPathChange,
  onReadyChange,
  path,
}: Props) {
  const [status, setStatus] = useState<ClaudeCodeStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPath, setShowPath] = useState(path.trim().length > 0);
  const [pathDraft, setPathDraft] = useState(path);
  const requestId = useRef(0);
  const onReadyChangeRef = useRef(onReadyChange);
  onReadyChangeRef.current = onReadyChange;

  async function check() {
    const id = ++requestId.current;
    setChecking(true);
    setCheckError("");
    try {
      const next = await getClaudeCodeStatus();
      if (id !== requestId.current) return;
      setStatus(next);
      onReadyChangeRef.current(next.usable);
    } catch (error: unknown) {
      if (id !== requestId.current) return;
      setStatus(null);
      setCheckError(describeAiSettingsError(error, "Couldn't check Claude Code."));
    } finally {
      if (id === requestId.current) setChecking(false);
    }
  }
  const checkRef = useRef(check);
  checkRef.current = check;

  // Re-check whenever the saved path changes (including the first render).
  useEffect(() => {
    void checkRef.current();
  }, [path]);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copyLoginCommand() {
    try {
      await navigator.clipboard.writeText(CLAUDE_CODE_LOGIN_COMMAND);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const reason = status?.reason ?? null;
  const accountStatus = checking
    ? { kind: "idle" as const, label: "Checking Claude Code…" }
    : checkError
      ? { kind: "error" as const, label: "Check failed", detail: checkError }
      : status?.usable
        ? {
            kind: "success" as const,
            label: "Using Claude plan",
            detail: [
              status.message,
              status.email,
              status.version && `Claude Code ${status.version}`,
            ]
              .filter(Boolean)
              .join(" · "),
          }
        : status
          ? {
              kind: "error" as const,
              label:
                reason === "notInstalled"
                  ? "Claude Code not found"
                  : reason === "signedOut"
                    ? "Not signed in"
                    : reason === "apiBilling"
                      ? "Not using a Claude plan"
                      : "Not ready",
              detail: status.message,
            }
          : { kind: "idle" as const, label: "Not checked" };
  const needsInstall = !checking && reason === "notInstalled";
  const needsLogin = !checking && (reason === "signedOut" || reason === "apiBilling");

  return (
    <div className={styles.panel}>
      <SettingsConnectionStatus {...accountStatus} />

      {needsInstall ? (
        <ol className={styles.steps}>
          <li>
            Install Claude Code.{" "}
            <button
              className={styles.linkBtn}
              onClick={() => onOpenUrl(CLAUDE_CODE_SETUP_URL)}
              type="button"
            >
              Setup guide
            </button>
          </li>
          <li>
            In a terminal, run <code className={styles.code}>{CLAUDE_CODE_LOGIN_COMMAND}</code> and
            sign in with your Claude account.
          </li>
          <li>Come back and check again.</li>
        </ol>
      ) : null}

      {needsLogin ? (
        <div className={styles.commandRow}>
          <code className={styles.code}>{CLAUDE_CODE_LOGIN_COMMAND}</code>
          <button className={styles.quietBtn} onClick={() => void copyLoginCommand()} type="button">
            <CopyIcon />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}

      {status?.usable ? (
        <div className={styles.field}>
          <span className={styles.fieldLabel} id="settings-claude-model-label">
            Model
          </span>
          <div className={styles.chips} role="group" aria-labelledby="settings-claude-model-label">
            {CLAUDE_CODE_MODELS.map((option) => (
              <button
                aria-pressed={model === option.id}
                className={`${styles.chip}${model === option.id ? ` ${styles.active}` : ""}`}
                disabled={disabled}
                key={option.id}
                onClick={() => onModelChange(option.id)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className={styles.hint}>
            Pupil asks Claude Code for the latest model in each family. Test the connection to
            confirm your plan includes it.
          </p>
        </div>
      ) : null}

      <div className={styles.actions}>
        <button
          className={status?.usable ? styles.quietBtn : styles.primaryBtn}
          disabled={disabled || checking}
          onClick={() => void check()}
          type="button"
        >
          {checking ? "Checking…" : "Check again"}
        </button>
        <button
          aria-controls="settings-claude-path"
          aria-expanded={showPath}
          className={styles.linkBtn}
          onClick={() => setShowPath((current) => !current)}
          type="button"
        >
          {showPath ? "Hide install location" : "Claude Code is somewhere else?"}
        </button>
      </div>

      {showPath ? (
        <div className={styles.field} id="settings-claude-path">
          <label className={styles.fieldLabel} htmlFor="settings-claude-path-input">
            Claude Code location
          </label>
          <div className={styles.commandRow}>
            <input
              className={styles.input}
              disabled={disabled}
              id="settings-claude-path-input"
              onChange={(event) => setPathDraft(event.target.value)}
              placeholder={status?.path ?? "/Users/you/.local/bin/claude"}
              spellCheck={false}
              type="text"
              value={pathDraft}
            />
            <button
              className={styles.quietBtn}
              disabled={disabled || pathDraft.trim() === path.trim()}
              onClick={() => onPathChange(pathDraft.trim())}
              type="button"
            >
              Use
            </button>
          </div>
          <p className={styles.hint}>
            The full path to the <code className={styles.code}>claude</code> program. Leave empty to
            find it automatically.
          </p>
        </div>
      ) : null}

      <p className={styles.hint}>
        Pupil runs your own Claude Code with every tool turned off and never reads its sign-in. Card
        text and prompts go to Anthropic under your Claude account. To sign out of Claude Code
        itself, run <code className={styles.code}>claude auth logout</code>.
      </p>
    </div>
  );
}
