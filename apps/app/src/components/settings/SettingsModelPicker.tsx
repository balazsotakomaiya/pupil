import { useEffect, useRef, useState } from "react";
import { type AiModelCatalog, discoverAiModels, orderDiscoveredModels } from "../../lib/ai-models";
import { getRecommendedModelsForBaseUrl } from "../../lib/ai-providers";
import { describeAiSettingsError } from "../../lib/ai-settings";
import styles from "./Settings.module.css";

type Props = {
  apiKey?: string;
  autoDiscover: boolean;
  baseUrl: string;
  disabled: boolean;
  model: string;
  onChange: (model: string) => void;
  saved: boolean;
};

export function SettingsModelPicker({
  apiKey,
  autoDiscover,
  baseUrl,
  disabled,
  model,
  onChange,
  saved,
}: Props) {
  const [catalog, setCatalog] = useState<AiModelCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const attemptedUrl = useRef("");
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    requestId.current += 1;
    attemptedUrl.current = "";
    setCatalog(null);
    setLoading(false);
    setError("");
    return () => {
      requestId.current += 1;
    };
  }, [baseUrl]);

  async function refresh() {
    const id = ++requestId.current;
    attemptedUrl.current = baseUrl;
    setLoading(true);
    setError("");
    try {
      const result = await discoverAiModels({ baseUrl, apiKey });
      if (requestId.current !== id) return;
      if (!result.models.length) throw new Error("This endpoint returned no text models.");
      setCatalog(result);
    } catch (failure) {
      if (requestId.current !== id) return;
      setCatalog(null);
      setError(describeAiSettingsError(failure, "Couldn't load models."));
    } finally {
      if (requestId.current === id) setLoading(false);
    }
  }
  refreshRef.current = refresh;

  useEffect(() => {
    if (autoDiscover && attemptedUrl.current !== baseUrl) void refreshRef.current();
  }, [autoDiscover, baseUrl]);

  const models = catalog
    ? orderDiscoveredModels(baseUrl, catalog)
    : getRecommendedModelsForBaseUrl(baseUrl);
  return (
    <div className={styles.settingsField}>
      <div className={styles.settingsModelHeading}>
        <label className={styles.settingsFieldLabel} htmlFor="settings-model">
          Model {saved && <span className={styles.settingsAutosaveBadge}>Saved</span>}
        </label>
        <button
          className={styles.settingsModelRefresh}
          disabled={disabled || loading}
          onClick={() => void refresh()}
          type="button"
        >
          {loading ? "Loading models…" : "Refresh models"}
        </button>
      </div>
      <input
        className={`${styles.settingsTextInput} ${styles.settingsTextInputMono}`}
        disabled={disabled}
        id="settings-model"
        list="settings-model-options"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Enter model name"
        value={model}
      />
      <datalist id="settings-model-options">
        {models.map((id) => (
          <option key={id} value={id} />
        ))}
      </datalist>
      <div
        className={styles.settingsModelChips}
        role="group"
        aria-label={catalog?.popular ? "Popular models" : "Suggested models"}
      >
        {models.slice(0, 4).map((id) => (
          <button
            aria-pressed={model === id}
            className={`${styles.settingsModelChip}${model === id ? ` ${styles.active}` : ""}`}
            disabled={disabled}
            key={id}
            onClick={() => onChange(id)}
            type="button"
          >
            {id}
          </button>
        ))}
      </div>
      <p className={styles.settingsFieldHint} aria-live="polite">
        {error
          ? `${error} Using fallback suggestions.`
          : catalog
            ? `${catalog.popular ? "Popular" : "Available"} models from this endpoint. Type to search or enter any model ID.`
            : "Suggested models for this URL. Refresh to load its catalog, or enter any model ID."}
      </p>
    </div>
  );
}
