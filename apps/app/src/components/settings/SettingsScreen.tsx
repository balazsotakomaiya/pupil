import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  describeAiSettingsError,
  loadAiSettings,
  saveAiSettings,
  testAiProviderConnection,
} from "../../lib/ai-settings";
import {
  exportDatabaseCopy,
  exportReviewLogsCsv,
  getSettingsDataSummary,
} from "../../lib/data-actions";
import { SettingsAboutCard } from "./SettingsAboutCard";
import { SettingsConnectionStatus } from "./SettingsConnectionStatus";
import { SettingsDataCard } from "./SettingsDataCard";
import {
  ArrowRightIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  EyeClosedIcon,
  EyeOpenIcon,
  TrashIcon,
} from "./SettingsIcons";
import { SettingsNav, type SettingsSectionId } from "./SettingsNav";
import { SettingsShortcutsGrid } from "./SettingsShortcutsGrid";

type SettingsScreenProps = {
  cardsCount: number;
  onResetAllData: () => Promise<void>;
  spacesCount: number;
};

type SavedSettingsSnapshot = {
  baseUrl: string;
  hasApiKey: boolean;
  maxTokens: string;
  model: string;
  temperature: string;
};

const SHORTCUTS = [
  { keys: ["Space"], label: "Reveal card" },
  { keys: ["1"], label: "Rate: Again" },
  { keys: ["2"], label: "Rate: Hard" },
  { keys: ["3"], label: "Rate: Good" },
  { keys: ["4"], label: "Rate: Easy" },
  { keys: ["⌘", "N"], label: "New card" },
  { keys: ["⌘", "K"], label: "Search" },
  { keys: ["⌘", ","], label: "Settings" },
];

// Module-level: survives component unmount/remount within the same tab session.
let _connectionStatusCache: {
  detail?: string;
  kind: "idle" | "success" | "error";
  label: string;
} | null = null;

function detectProviderFromKey(key: string): { baseUrl: string; model: string } | null {
  if (key.length < 10) return null;
  if (key.startsWith("sk-ant-")) {
    return { baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-6" };
  }
  if (key.startsWith("sk-")) {
    return { baseUrl: "https://api.openai.com/v1", model: "gpt-5.4" };
  }
  if (key.startsWith("AIza")) {
    return {
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: "gemini-2.5-pro",
    };
  }
  return null;
}

function detectModelFromUrl(url: string): string | null {
  if (url.includes("anthropic.com")) return "claude-sonnet-4-6";
  if (url.includes("openai.com")) return "gpt-5.4";
  if (url.includes("generativelanguage.googleapis.com")) return "gemini-2.5-pro";
  return null;
}

export function SettingsScreen({
  cardsCount,
  onResetAllData,
  spacesCount,
}: SettingsScreenProps) {
  const hasUserEditedSettings = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  // Updated on every render so the timeout callback always uses latest state.
  const handleAutoSave = useRef<() => void>(() => {});
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("ai");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyEdited, setApiKeyEdited] = useState(false);
  const [hasStoredApiKey, setHasStoredApiKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [model, setModel] = useState("gpt-5.4");
  const [maxTokens, setMaxTokens] = useState("4096");
  const [temperature, setTemperature] = useState("0.7");
  const [savedSettings, setSavedSettings] = useState<SavedSettingsSnapshot>({
    baseUrl: "https://api.openai.com/v1",
    hasApiKey: false,
    maxTokens: "4096",
    model: "gpt-5.4",
    temperature: "0.7",
  });
  const [lastSavedField, setLastSavedField] = useState<
    "baseUrl" | "model" | "maxTokens" | "temperature" | null
  >(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [databasePath, setDatabasePath] = useState("Loading database path…");
  const [reviewLogCount, setReviewLogCount] = useState(0);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isExportingDatabase, setIsExportingDatabase] = useState(false);
  const [isExportingReviewLogs, setIsExportingReviewLogs] = useState(false);
  const [isResettingData, setIsResettingData] = useState(false);
  const [recentlySaved, setRecentlySaved] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    detail?: string;
    kind: "idle" | "success" | "error";
    label: string;
  }>(
    () =>
      _connectionStatusCache ?? {
        detail: "Checking local provider settings…",
        kind: "idle",
        label: "Not tested",
      },
  );
  const [dataStatus, setDataStatus] = useState<{
    detail?: string;
    kind: "idle" | "success" | "error";
    label: string;
  }>({
    detail: "Database and review exports land on this device.",
    kind: "idle",
    label: "Ready",
  });

  const aiRef = useRef<HTMLElement | null>(null);
  const dataRef = useRef<HTMLElement | null>(null);
  const shortcutsRef = useRef<HTMLElement | null>(null);
  const aboutRef = useRef<HTMLElement | null>(null);

  const sectionRefs = useMemo(
    () => ({
      about: aboutRef,
      ai: aiRef,
      data: dataRef,
      shortcuts: shortcutsRef,
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAiState() {
      try {
        const settings = await loadAiSettings();

        if (cancelled) {
          return;
        }

        setHasStoredApiKey(settings.hasApiKey);
        setSavedSettings({
          baseUrl: settings.baseUrl,
          hasApiKey: settings.hasApiKey,
          maxTokens: settings.maxTokens,
          model: settings.model,
          temperature: settings.temperature,
        });

        if (!hasUserEditedSettings.current) {
          setApiKey("");
          setApiKeyEdited(false);
          setBaseUrl(settings.baseUrl);
          setModel(settings.model);
          setMaxTokens(settings.maxTokens);
          setTemperature(settings.temperature);
        }

        if (!_connectionStatusCache) {
          setConnectionStatus({
            detail: settings.hasApiKey
              ? "API key stored safely on this device. Click Save after editing to persist changes."
              : "No saved API key yet. Click Save after editing to persist changes.",
            kind: "idle",
            label: "Not tested",
          });
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setConnectionStatus({
            detail: describeAiSettingsError(error, "Failed to load AI settings."),
            kind: "error",
            label: "Load failed",
          });
          setDataStatus({
            detail: describeAiSettingsError(error, "Failed to load data actions."),
            kind: "error",
            label: "Load failed",
          });
        }
      }
    }

    async function loadDataState() {
      try {
        const dataSummary = await getSettingsDataSummary();

        if (cancelled) {
          return;
        }

        setDatabasePath(dataSummary.databasePath);
        setReviewLogCount(dataSummary.reviewLogCount);
      } catch (error: unknown) {
        if (!cancelled) {
          setDataStatus({
            detail: describeAiSettingsError(error, "Failed to load data actions."),
            kind: "error",
            label: "Load failed",
          });
        }
      }
    }

    void loadAiState();
    void loadDataState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function updateActiveSection() {
      const entries = (Object.entries(sectionRefs) as Array<
        [SettingsSectionId, RefObject<HTMLElement | null>]
      >)
        .map(([id, ref]) => ({
          id,
          top: ref.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
        }))
        .filter((entry) => Number.isFinite(entry.top))
        .sort((left, right) => Math.abs(left.top - 140) - Math.abs(right.top - 140));

      if (entries[0]) {
        setActiveSection(entries[0].id);
      }
    }

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });

    return () => window.removeEventListener("scroll", updateActiveSection);
  }, [sectionRefs]);

  useEffect(() => {
    if (copyState !== "copied") {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopyState("idle"), 1500);
    return () => window.clearTimeout(timeoutId);
  }, [copyState]);

  useEffect(() => {
    if (!recentlySaved) {
      return;
    }

    const timeoutId = window.setTimeout(() => setRecentlySaved(false), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [recentlySaved]);

  // Cancel any pending autosave on unmount.
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Updated on every render so the timeout always calls the latest closure.
  handleAutoSave.current = () => {
    if (!apiKeyEdited) {
      void persistSettings({ announceSaved: true });
    }
  };

  function scheduleAutoSave(field: "baseUrl" | "model" | "maxTokens" | "temperature") {
    setLastSavedField(field);
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      handleAutoSave.current();
    }, 800);
  }

  function handleSelectSection(sectionId: SettingsSectionId) {
    setActiveSection(sectionId);
    sectionRefs[sectionId].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function refreshDataSummary() {
    const summary = await getSettingsDataSummary();
    setDatabasePath(summary.databasePath);
    setReviewLogCount(summary.reviewLogCount);
  }

  async function handleCopyPath() {
    try {
      await navigator.clipboard.writeText(databasePath);
      setCopyState("copied");
    } catch {
      setCopyState("idle");
    }
  }

  async function persistSettings(options?: { announceSaved?: boolean }) {
    setIsSavingSettings(true);

    try {
      const saved = await saveAiSettings({
        apiKey: apiKeyEdited ? apiKey : undefined,
        baseUrl,
        model,
        maxTokens,
        temperature,
      });

      setApiKey("");
      setApiKeyEdited(false);
      hasUserEditedSettings.current = false;
      setHasStoredApiKey(saved.hasApiKey);
      setSavedSettings({
        baseUrl: saved.baseUrl,
        hasApiKey: saved.hasApiKey,
        maxTokens: saved.maxTokens,
        model: saved.model,
        temperature: saved.temperature,
      });

      if (options?.announceSaved ?? true) {
        setRecentlySaved(true);
      }

      return saved;
    } catch (error: unknown) {
      setConnectionStatus({
        detail: describeAiSettingsError(error, "Failed to save AI settings."),
        kind: "error",
        label: "Save failed",
      });
      throw error;
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleSaveSettings() {
    try {
      await persistSettings();
    } catch {
      // persistSettings already updates the UI state with the failure.
    }
  }

  async function handleTestConnection() {
    setIsTestingConnection(true);

    try {
      if (hasUnsavedChanges) {
        await persistSettings({ announceSaved: false });
      }

      const result = await testAiProviderConnection({
        apiKey: apiKeyEdited ? apiKey : undefined,
        baseUrl,
        model,
        maxTokens,
        temperature,
      });
      const nextStatus = {
        detail: result.detail,
        kind: "success" as const,
        label: result.label,
      };
      _connectionStatusCache = nextStatus;
      setConnectionStatus(nextStatus);
    } catch (error: unknown) {
      setConnectionStatus({
        detail: describeAiSettingsError(error, "Connection test failed."),
        kind: "error",
        label: "Connection failed",
      });
    } finally {
      setIsTestingConnection(false);
    }
  }

  async function handleExportDatabase() {
    setIsExportingDatabase(true);

    try {
      const result = await exportDatabaseCopy();
      setDataStatus({
        detail: result.path,
        kind: "success",
        label: "Database exported",
      });
    } catch (error: unknown) {
      setDataStatus({
        detail: describeAiSettingsError(error, "Database export failed."),
        kind: "error",
        label: "Export failed",
      });
    } finally {
      setIsExportingDatabase(false);
    }
  }

  async function handleExportReviewLogs() {
    setIsExportingReviewLogs(true);

    try {
      const result = await exportReviewLogsCsv();
      setDataStatus({
        detail:
          result.recordCount > 0
            ? `${result.recordCount} rows · ${result.path}`
            : `No review rows yet · ${result.path}`,
        kind: "success",
        label: "Review logs exported",
      });
    } catch (error: unknown) {
      setDataStatus({
        detail: describeAiSettingsError(error, "Review log export failed."),
        kind: "error",
        label: "Export failed",
      });
    } finally {
      setIsExportingReviewLogs(false);
    }
  }

  async function handleReset() {
    if (
      !window.confirm(
        "Reset all local data? This removes spaces, cards, review history, saved AI settings, and the stored API key.",
      )
    ) {
      return;
    }

    setIsResettingData(true);

    try {
      await onResetAllData();
      const nextSettings = await loadAiSettings();
      await refreshDataSummary();
      hasUserEditedSettings.current = false;
      setApiKey("");
      setApiKeyEdited(false);
      setHasStoredApiKey(nextSettings.hasApiKey);
      setBaseUrl(nextSettings.baseUrl);
      setModel(nextSettings.model);
      setMaxTokens(nextSettings.maxTokens);
      setTemperature(nextSettings.temperature);
      setSavedSettings({
        baseUrl: nextSettings.baseUrl,
        hasApiKey: nextSettings.hasApiKey,
        maxTokens: nextSettings.maxTokens,
        model: nextSettings.model,
        temperature: nextSettings.temperature,
      });
      _connectionStatusCache = null;
      setConnectionStatus({
        detail: nextSettings.hasApiKey
          ? "API key stored safely on this device."
          : "No saved API key yet",
        kind: "idle",
        label: "Not tested",
      });
      setDataStatus({
        detail: "Local study data and saved AI settings were cleared.",
        kind: "success",
        label: "Reset complete",
      });
    } catch (error: unknown) {
      setDataStatus({
        detail: describeAiSettingsError(error, "Reset failed."),
        kind: "error",
        label: "Reset failed",
      });
    } finally {
      setIsResettingData(false);
    }
  }

  function handleOpenExternal(kind: "docs" | "github" | "issues") {
    const urls = {
      docs: "https://github.com",
      github: "https://github.com",
      issues: "https://github.com/issues",
    };

    window.open(urls[kind], "_blank", "noopener,noreferrer");
  }

  const apiKeyHint = hasStoredApiKey
    ? "Leave the field empty to keep the stored key, or enter a new one to replace it."
    : "API key will be stored safely on this device. Add one to enable live generation.";
  const hasUnsavedChanges =
    apiKeyEdited ||
    hasStoredApiKey !== savedSettings.hasApiKey ||
    baseUrl !== savedSettings.baseUrl ||
    model !== savedSettings.model ||
    maxTokens !== savedSettings.maxTokens ||
    temperature !== savedSettings.temperature;
  const isSettingsBusy = isSavingSettings || isTestingConnection;
  const areSettingsActionsBusy = isSavingSettings || isTestingConnection;

  return (
    <div className="page settings-page">
      <section className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-desc">
          AI provider configuration, data management, and app preferences.
        </p>
      </section>

      <SettingsNav activeSection={activeSection} onSelect={handleSelectSection} />

      <div className="ruler-divider" />

      <section className="settings-section" id="ai" ref={aiRef}>
        <div className="settings-section-head">
          <div className="settings-section-title">AI Provider</div>
          <div className="settings-section-desc">
            Pupil stores the API key safely on this device and keeps the non-secret provider
            settings in the local app database. Generation and provider tests now use these saved
            values directly.
          </div>
        </div>

        <div className="settings-field-group">
          <div className="settings-field">
            <label className="settings-field-label" htmlFor="settings-api-key">
              API Key
              <span className="settings-label-badge">Stored safely</span>
            </label>
            <div className="settings-key-input-wrap">
              <div className="settings-key-field-wrap">
                <input
                  className="settings-text-input settings-text-input-mono"
                  disabled={isSettingsBusy}
                  id="settings-api-key"
                  onChange={(event) => {
                    hasUserEditedSettings.current = true;
                    const value = event.target.value;
                    setApiKey(value);
                    setApiKeyEdited(true);
                    const provider = detectProviderFromKey(value);
                    if (provider) {
                      setBaseUrl(provider.baseUrl);
                      setModel(provider.model);
                    }
                  }}
                  placeholder={hasStoredApiKey ? "Stored — enter to replace" : "sk-..."}
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                />
                <button
                  aria-label={showApiKey ? "Hide API key" : "Show API key"}
                  className="settings-key-reveal"
                  disabled={isSettingsBusy}
                  onClick={() => setShowApiKey((current) => !current)}
                  type="button"
                >
                  {showApiKey ? <EyeClosedIcon /> : <EyeOpenIcon />}
                </button>
              </div>
              <div className="settings-key-actions">
                <button
                  className="settings-key-save-btn"
                  disabled={areSettingsActionsBusy || !apiKeyEdited}
                  onClick={() => void handleSaveSettings()}
                  type="button"
                >
                  {isSavingSettings ? "Saving…" : "Save"}
                </button>
                <button
                  className="settings-key-test-btn"
                  disabled={areSettingsActionsBusy}
                  onClick={() => void handleTestConnection()}
                  type="button"
                >
                  <ArrowRightIcon />
                  {isTestingConnection ? "Testing…" : "Test"}
                </button>
              </div>
            </div>
            <div className="settings-field-hint">{apiKeyHint}</div>
          </div>

          <SettingsConnectionStatus
            detail={connectionStatus.detail}
            kind={connectionStatus.kind}
            label={connectionStatus.label}
          />

          <div className="settings-field">
            <label className="settings-field-label" htmlFor="settings-base-url">
              Base URL
              {recentlySaved && lastSavedField === "baseUrl" && (
                <span className="settings-autosave-badge">Saved</span>
              )}
            </label>
            <input
              className="settings-text-input settings-text-input-mono"
              disabled={isSettingsBusy}
              id="settings-base-url"
              onChange={(event) => {
                hasUserEditedSettings.current = true;
                const value = event.target.value;
                setBaseUrl(value);
                const detectedModel = detectModelFromUrl(value);
                if (detectedModel) setModel(detectedModel);
                scheduleAutoSave("baseUrl");
              }}
              placeholder="https://api.openai.com/v1"
              type="text"
              value={baseUrl}
            />
            <div className="settings-field-hint">
              OpenAI-compatible endpoint. Change this for Anthropic, Ollama, or a self-hosted
              proxy.
            </div>
          </div>

          <div className="settings-field">
            <label className="settings-field-label" htmlFor="settings-model">
              Model
              {recentlySaved && lastSavedField === "model" && (
                <span className="settings-autosave-badge">Saved</span>
              )}
            </label>
            <input
              className="settings-text-input settings-text-input-mono"
              disabled={isSettingsBusy}
              id="settings-model"
              onChange={(event) => {
                hasUserEditedSettings.current = true;
                setModel(event.target.value);
                scheduleAutoSave("model");
              }}
              placeholder="Enter model name"
              type="text"
              value={model}
            />
            <div className="settings-model-chips">
              {["gpt-5.4", "claude-sonnet-4-6", "claude-opus-4-6"].map((chip) => (
                <button
                  className={`settings-model-chip${model === chip ? " active" : ""}`}
                  disabled={isSettingsBusy}
                  key={chip}
                  onClick={() => {
                    hasUserEditedSettings.current = true;
                    setModel(chip);
                    scheduleAutoSave("model");
                  }}
                  type="button"
                >
                  {chip}
                </button>
              ))}
            </div>
            <div className="settings-field-hint">
              Pick a recommended model or type any model identifier your provider supports.
            </div>
          </div>

          <div>
            <button
              className={`settings-advanced-toggle${advancedOpen ? " open" : ""}`}
              onClick={() => setAdvancedOpen((current) => !current)}
              type="button"
            >
              <ChevronRightIcon />
              Advanced
            </button>

            <div className={`settings-advanced-fields${advancedOpen ? " open" : ""}`}>
              <div className="settings-field-row">
                <div className="settings-field">
                  <label className="settings-field-label" htmlFor="settings-max-tokens">
                    Max Tokens
                    {recentlySaved && lastSavedField === "maxTokens" && (
                      <span className="settings-autosave-badge">Saved</span>
                    )}
                  </label>
                  <input
                    className="settings-text-input settings-text-input-mono"
                    disabled={isSettingsBusy}
                    id="settings-max-tokens"
                    onChange={(event) => {
                      hasUserEditedSettings.current = true;
                      setMaxTokens(event.target.value);
                      scheduleAutoSave("maxTokens");
                    }}
                    placeholder="4096"
                    type="text"
                    value={maxTokens}
                  />
                </div>

                <div className="settings-field">
                  <label className="settings-field-label" htmlFor="settings-temperature">
                    Temperature
                    {recentlySaved && lastSavedField === "temperature" && (
                      <span className="settings-autosave-badge">Saved</span>
                    )}
                  </label>
                  <input
                    className="settings-text-input settings-text-input-mono"
                    disabled={isSettingsBusy}
                    id="settings-temperature"
                    onChange={(event) => {
                      hasUserEditedSettings.current = true;
                      setTemperature(event.target.value);
                      scheduleAutoSave("temperature");
                    }}
                    placeholder="0.0 – 2.0"
                    type="text"
                    value={temperature}
                  />
                </div>
              </div>

              <div className="settings-field-hint">
                Lower temperature produces more predictable cards. Higher adds variety but can
                reduce accuracy.
              </div>
            </div>
          </div>

        </div>
      </section>

      <div className="ruler-divider" />

      <section className="settings-section" id="data" ref={dataRef}>
        <div className="settings-section-head">
          <div className="settings-section-title">Data</div>
          <div className="settings-section-desc">
            All study data is stored locally. Export creates a real copy of the database or review
            logs, and reset clears this device.
          </div>
        </div>

        <div className="settings-data-section-body">
        <div className="settings-data-cards">
          <SettingsDataCard
            action={
              <button
                className="settings-data-btn"
                disabled={isExportingDatabase}
                onClick={() => void handleExportDatabase()}
                type="button"
              >
                <DownloadIcon />
                {isExportingDatabase ? "Exporting…" : "Export"}
              </button>
            }
            description="Live SQLite file containing all spaces, cards, scheduler state, and study metadata."
            title="Database"
            value={
              <>
                <strong>{spacesCount}</strong> spaces · <strong>{cardsCount}</strong> cards
              </>
            }
          />

          <SettingsDataCard
            action={
              <button
                className="settings-data-btn"
                disabled={isExportingReviewLogs}
                onClick={() => void handleExportReviewLogs()}
                type="button"
              >
                <DownloadIcon />
                {isExportingReviewLogs ? "Exporting…" : "Export CSV"}
              </button>
            }
            description="Review history recorded during study sessions. Export writes a CSV with one row per review."
            title="Review Logs"
            value={
              <>
                <strong>{reviewLogCount}</strong> reviews
              </>
            }
          />

          <SettingsDataCard
            action={
              <button className="settings-data-btn" onClick={() => void handleCopyPath()} type="button">
                <CopyIcon />
                {copyState === "copied" ? "Copied" : "Copy"}
              </button>
            }
            description={<span className="settings-data-card-desc-path">{databasePath}</span>}
            title="Database Path"
          />

          <SettingsDataCard
            action={
              <button
                className="settings-data-btn danger"
                disabled={isResettingData}
                onClick={() => void handleReset()}
                type="button"
              >
                <TrashIcon />
                {isResettingData ? "Resetting…" : "Reset"}
              </button>
            }
            description="Delete all spaces, cards, review history, saved AI settings, and the stored API key from this device."
            title="Reset All Data"
            tone="danger"
          />
        </div>

        <SettingsConnectionStatus
          detail={dataStatus.detail}
          kind={dataStatus.kind}
          label={dataStatus.label}
        />
        </div>
      </section>

      <div className="ruler-divider" />

      <section className="settings-section" id="shortcuts" ref={shortcutsRef}>
        <div className="settings-section-head">
          <div className="settings-section-title">Keyboard Shortcuts</div>
          <div className="settings-section-desc">
            Active during study sessions and general navigation.
          </div>
        </div>

        <SettingsShortcutsGrid items={SHORTCUTS} />
      </section>

      <div className="ruler-divider" />

      <section className="settings-section" id="about" ref={aboutRef}>
        <div className="settings-section-head">
          <div className="settings-section-title">About</div>
        </div>

        <SettingsAboutCard
          onOpenDocs={() => handleOpenExternal("docs")}
          onOpenGithub={() => handleOpenExternal("github")}
          onOpenIssues={() => handleOpenExternal("issues")}
        />
      </section>

      <div className="page-end" />
    </div>
  );
}
