import { useEffect, useRef, useState } from "react";
import {
  CHATGPT_USAGE_URL,
  type ChatgptModelOption,
  cancelChatgptSignIn,
  disconnectChatgpt,
  listChatgptModels,
  pickChatgptModel,
  startChatgptSignIn,
} from "../../lib/ai-connections";
import {
  type AiSettings,
  type ChatgptConnectionState,
  describeAiSettingsError,
} from "../../lib/ai-settings";
import { isAiConnectionError } from "../../lib/errors";
import styles from "./SettingsAiConnection.module.css";
import { SettingsConnectionStatus } from "./SettingsConnectionStatus";

type Props = {
  disabled: boolean;
  model: string;
  onModelChange: (model: string) => void;
  onOpenUrl: (url: string) => void;
  onSettingsChanged: (settings: AiSettings) => void;
  state: ChatgptConnectionState;
};

type Notice = { kind: "idle" | "success" | "error"; label: string; detail?: string };

export function SettingsChatgptPanel({
  disabled,
  model,
  onModelChange,
  onOpenUrl,
  onSettingsChanged,
  state,
}: Props) {
  const [signingIn, setSigningIn] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [models, setModels] = useState<ChatgptModelOption[] | null>(null);
  const [modelsError, setModelsError] = useState("");
  const latestModel = useRef(model);
  latestModel.current = model;
  const onModelChangeRef = useRef(onModelChange);
  onModelChangeRef.current = onModelChange;

  const connected = state.status === "connected";
  const usable = connected && state.planUsage;

  useEffect(() => {
    if (!usable) {
      setModels(null);
      return;
    }
    let cancelled = false;
    setModelsError("");
    listChatgptModels()
      .then((list) => {
        if (cancelled) return;
        setModels(list);
        const picked = pickChatgptModel(latestModel.current, list);
        if (picked !== latestModel.current) onModelChangeRef.current(picked);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setModels(null);
        setModelsError(describeAiSettingsError(error, "Couldn't load your plan's models."));
      });
    return () => {
      cancelled = true;
    };
  }, [usable]);

  async function handleSignIn() {
    setSigningIn(true);
    setNotice(null);
    try {
      const settings = await startChatgptSignIn();
      onSettingsChanged(settings);
      setShowWelcome(settings.chatgpt.planUsage);
    } catch (error: unknown) {
      if (!isAiConnectionError(error, "cancelled")) {
        setNotice({
          kind: "error",
          label: "Not connected",
          detail: describeAiSettingsError(error, "ChatGPT sign-in failed."),
        });
      }
    } finally {
      setSigningIn(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setNotice(null);
    try {
      const result = await disconnectChatgpt();
      onSettingsChanged(result.settings);
      setShowWelcome(false);
      setNotice(
        result.remoteRevoked
          ? {
              kind: "idle",
              label: "Disconnected",
              detail: "Pupil no longer uses your ChatGPT plan.",
            }
          : {
              kind: "idle",
              label: "Disconnected on this device",
              detail:
                "OpenAI didn't confirm the sign-out. You can also remove Pupil in ChatGPT settings.",
            },
      );
    } catch (error: unknown) {
      setNotice({
        kind: "error",
        label: "Disconnect failed",
        detail: describeAiSettingsError(error, "Couldn't disconnect ChatGPT."),
      });
    } finally {
      setDisconnecting(false);
    }
  }

  const busy = disabled || signingIn || disconnecting;
  const accountStatus: Notice = usable
    ? { kind: "success", label: "Using ChatGPT plan", detail: state.email ?? undefined }
    : connected
      ? {
          kind: "error",
          label: "Plan usage not allowed",
          detail: "Reconnect and allow plan usage, or use an API key.",
        }
      : state.status === "expired"
        ? {
            kind: "error",
            label: "Connection ended",
            detail: "Reconnect to keep using your ChatGPT plan.",
          }
        : {
            kind: "idle",
            label: "Not connected",
            detail: "Requests count toward your ChatGPT plan's usage limits.",
          };

  return (
    <div className={styles.panel}>
      <SettingsConnectionStatus {...accountStatus} />

      {showWelcome ? (
        <div className={styles.callout} role="note">
          <div className={styles.calloutTitle}>You're using your ChatGPT plan</div>
          <p className={styles.calloutText}>
            Card generation and explanations in Pupil now use your ChatGPT plan. You can limit how
            much Pupil may use in ChatGPT settings.
          </p>
          <div className={styles.actions}>
            <button className={styles.quietBtn} onClick={() => setShowWelcome(false)} type="button">
              Got it
            </button>
            <button
              className={styles.linkBtn}
              onClick={() => onOpenUrl(CHATGPT_USAGE_URL)}
              type="button"
            >
              Manage usage
            </button>
          </div>
        </div>
      ) : null}

      {usable ? (
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="settings-chatgpt-model">
            Model
          </label>
          {models && models.length > 0 ? (
            <select
              className={styles.select}
              disabled={busy}
              id="settings-chatgpt-model"
              onChange={(event) => onModelChange(event.target.value)}
              value={model}
            >
              {models.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <div className={styles.fieldValue} id="settings-chatgpt-model">
              {model}
            </div>
          )}
          <p className={styles.hint} aria-live="polite">
            {modelsError
              ? `${modelsError} Test the connection to check this model.`
              : models
                ? "Models your ChatGPT plan can use."
                : "Loading the models your plan can use…"}
          </p>
        </div>
      ) : null}

      <div className={styles.actions}>
        {usable ? (
          <>
            <button
              className={styles.quietBtn}
              disabled={busy}
              onClick={() => void handleDisconnect()}
              type="button"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
            <button
              className={styles.linkBtn}
              onClick={() => onOpenUrl(CHATGPT_USAGE_URL)}
              type="button"
            >
              Manage usage
            </button>
          </>
        ) : (
          <>
            <button
              className={styles.primaryBtn}
              disabled={busy}
              onClick={() => void handleSignIn()}
              type="button"
            >
              {signingIn
                ? "Waiting for your browser…"
                : state.status === "disconnected"
                  ? "Continue with ChatGPT"
                  : "Reconnect ChatGPT"}
            </button>
            {signingIn ? (
              <button
                className={styles.quietBtn}
                onClick={() => void cancelChatgptSignIn()}
                type="button"
              >
                Cancel
              </button>
            ) : null}
            {state.status !== "disconnected" && !signingIn ? (
              <button
                className={styles.quietBtn}
                disabled={busy}
                onClick={() => void handleDisconnect()}
                type="button"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            ) : null}
          </>
        )}
      </div>

      {signingIn ? (
        <p className={styles.hint} aria-live="polite">
          Finish signing in in the browser window that opened, then come back here.
        </p>
      ) : null}

      {notice ? <SettingsConnectionStatus {...notice} /> : null}

      <p className={styles.hint}>
        Pupil signs in through OpenAI, never sees your password, and keeps the sign-in token in this
        device's secure storage. Card text and prompts go to OpenAI under your ChatGPT account.
      </p>
    </div>
  );
}
