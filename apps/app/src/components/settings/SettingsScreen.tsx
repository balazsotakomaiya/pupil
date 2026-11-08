import type { StudySettings } from "@pupil/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useRef, useState } from "react";
import { disconnectChatgpt } from "../../lib/ai-connections";
import {
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  getProviderForBaseUrl,
  getProviderForKey,
  supportsCustomTemperature,
} from "../../lib/ai-providers";
import {
  type AiConnectionKind,
  type AiSettings,
  type ChatgptConnectionState,
  DEFAULT_AI_SETTINGS,
  describeAiSettingsError,
  loadAiSettings,
  type SaveAiSettingsInput,
  saveAiSettings,
  testAiProviderConnection,
} from "../../lib/ai-settings";
import {
  exportDatabaseCopy,
  exportReviewLogsCsv,
  getSettingsDataSummary,
} from "../../lib/data-actions";
import { isTauriRuntime } from "../../lib/runtime";
import { DesktopAiNotice } from "../DesktopAiNotice";
import {
  ArrowRightIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  EyeClosedIcon,
  EyeOpenIcon,
  TrashIcon,
} from "../icons/SettingsIcons";
import { AppearanceSettingsCard } from "./AppearanceSettingsCard";
import styles from "./Settings.module.css";
import { SettingsAboutCard } from "./SettingsAboutCard";
import { SettingsAiConnectionPicker } from "./SettingsAiConnectionPicker";
import { SettingsChatgptPanel } from "./SettingsChatgptPanel";
import { SettingsClaudeCodePanel } from "./SettingsClaudeCodePanel";
import { SettingsConnectionStatus } from "./SettingsConnectionStatus";
import { SettingsDataCard } from "./SettingsDataCard";
import { SettingsModelPicker } from "./SettingsModelPicker";
import { SettingsNav, type SettingsSectionId } from "./SettingsNav";
import { SettingsShortcutsGrid } from "./SettingsShortcutsGrid";
import { StudySettingsCard } from "./StudySettingsCard";

type SettingsScreenProps = {
  cardsCount: number;
  /** Lets the page refresh AI gates elsewhere after a connection change. */
  onAiSettingsChanged?: () => void;
  isSavingStudySettings: boolean;
  onResetAllData: () => Promise<void>;
  onSaveStudySettings: (newCardsLimit: number | null) => Promise<void>;
  spacesCount: number;
  studySettings: StudySettings;
};

type SavedSettingsSnapshot = {
  baseUrl: string;
  explainEnabled: boolean;
  hasApiKey: boolean;
  maxTokens: string;
  model: string;
  temperature: string;
};

function snapshotOf(settings: AiSettings): SavedSettingsSnapshot {
  return {
    baseUrl: settings.baseUrl,
    explainEnabled: settings.explainEnabled,
    hasApiKey: settings.hasApiKey,
    maxTokens: settings.maxTokens,
    model: settings.model,
    temperature: settings.temperature,
  };
}

function idleStatusFor(settings: AiSettings): { detail: string; kind: "idle"; label: string } {
  const detail =
    settings.connection === "chatgpt"
      ? "Test to check your ChatGPT plan and model."
      : settings.connection === "claudeCode"
        ? "Test to check Claude Code and your plan's model."
        : settings.hasApiKey
          ? "API key saved on this device."
          : "Add an API key to connect your provider.";
  return { detail, kind: "idle", label: "Not tested" };
}

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
  const provider = getProviderForKey(key);
  return provider ? { baseUrl: provider.baseUrl, model: provider.defaultModel } : null;
}

function detectModelFromUrl(url: string): string | null {
  return getProviderForBaseUrl(url)?.defaultModel ?? null;
}

export function SettingsScreen({
  cardsCount,
  onAiSettingsChanged,
  isSavingStudySettings,
  onResetAllData,
  onSaveStudySettings,
  spacesCount,
  studySettings,
}: SettingsScreenProps) {
  const hasUserEditedSettings = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  // Updated on every render so the timeout callback always uses latest state.
  const handleAutoSave = useRef<() => void>(() => {});
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("general");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyEdited, setApiKeyEdited] = useState(false);
  const [hasStoredApiKey, setHasStoredApiKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_AI_BASE_URL);
  const [loadedBaseUrl, setLoadedBaseUrl] = useState<string | null>(null);
  const [model, setModel] = useState(DEFAULT_AI_MODEL);
  const [maxTokens, setMaxTokens] = useState("4096");
  const [temperature, setTemperature] = useState("0.7");
  const [explainEnabled, setExplainEnabled] = useState(true);
  const [connection, setConnection] = useState<AiConnectionKind>("apiKey");
  const [chatgptState, setChatgptState] = useState<ChatgptConnectionState>(
    DEFAULT_AI_SETTINGS.chatgpt,
  );
  const [claudeCode, setClaudeCode] = useState(DEFAULT_AI_SETTINGS.claudeCode);
  const [isAiLoaded, setIsAiLoaded] = useState(false);
  const [savedSettings, setSavedSettings] = useState<SavedSettingsSnapshot>({
    baseUrl: DEFAULT_AI_BASE_URL,
    explainEnabled: true,
    hasApiKey: false,
    maxTokens: "4096",
    model: DEFAULT_AI_MODEL,
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

  useEffect(() => {
    let cancelled = false;

    async function loadAiState() {
      try {
        const settings = await loadAiSettings();

        if (cancelled) {
          return;
        }

        setHasStoredApiKey(settings.hasApiKey);
        setLoadedBaseUrl(settings.baseUrl);
        setSavedSettings(snapshotOf(settings));
        setConnection(settings.connection);
        setChatgptState(settings.chatgpt);
        setClaudeCode(settings.claudeCode);
        setIsAiLoaded(true);

        if (!hasUserEditedSettings.current) {
          setApiKey("");
          setApiKeyEdited(false);
          setBaseUrl(settings.baseUrl);
          setModel(settings.model);
          setMaxTokens(settings.maxTokens);
          setTemperature(settings.temperature);
          setExplainEnabled(settings.explainEnabled);
        }

        if (!_connectionStatusCache) {
          setConnectionStatus(idleStatusFor(settings));
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
      void persistSettings({ announceSaved: true }).catch(() => {});
    }
  };

  function markSettingsEdited() {
    hasUserEditedSettings.current = true;
    _connectionStatusCache = null;
    setConnectionStatus({ kind: "idle", label: "Not tested" });
  }

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
    window.scrollTo(0, 0);
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

  function buildSaveInput(overrides?: Partial<SaveAiSettingsInput>): SaveAiSettingsInput {
    return {
      apiKey: apiKeyEdited ? apiKey : undefined,
      baseUrl,
      model,
      maxTokens,
      temperature,
      explainEnabled,
      connection,
      chatgptModel: chatgptState.model,
      claudeCodeModel: claudeCode.model,
      claudeCodePath: claudeCode.path,
      ...overrides,
    };
  }

  function applySubscriptionState(settings: AiSettings) {
    setConnection(settings.connection);
    setChatgptState(settings.chatgpt);
    setClaudeCode(settings.claudeCode);
    onAiSettingsChanged?.();
  }

  async function persistSettings(options?: {
    announceSaved?: boolean;
    overrides?: Partial<SaveAiSettingsInput>;
  }) {
    setIsSavingSettings(true);

    try {
      const saved = await saveAiSettings(buildSaveInput(options?.overrides));

      setApiKey("");
      setApiKeyEdited(false);
      hasUserEditedSettings.current = false;
      setHasStoredApiKey(saved.hasApiKey);
      setSavedSettings(snapshotOf(saved));
      applySubscriptionState(saved);

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

  /** Saves one subscription-side choice right away (connection, model, path). */
  async function saveSubscriptionChoice(overrides: Partial<SaveAiSettingsInput>) {
    markSettingsEdited();
    try {
      await persistSettings({ announceSaved: false, overrides });
    } catch {
      // persistSettings already shows the failure.
    }
  }

  function handleConnectionChange(next: AiConnectionKind) {
    if (next === connection) return;
    setConnection(next);
    void saveSubscriptionChoice({ connection: next });
  }

  async function handleTestConnection() {
    setIsTestingConnection(true);

    try {
      if (hasUnsavedChanges) {
        await persistSettings({ announceSaved: false });
      }

      const result = await testAiProviderConnection(buildSaveInput());
      if (connection === "claudeCode") {
        // A passing test is what marks Claude Code ready for the AI gates.
        setClaudeCode((current) => ({ ...current, ready: true }));
        onAiSettingsChanged?.();
      }
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
        label: "Collection exported",
      });
    } catch (error: unknown) {
      setDataStatus({
        detail: describeAiSettingsError(error, "Collection export failed."),
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
        "Reset all local data? This removes spaces, cards, review history, saved AI settings, the stored API key, and the ChatGPT connection.",
      )
    ) {
      return;
    }

    setIsResettingData(true);

    try {
      if (chatgptState.status !== "disconnected") {
        // Revoke with OpenAI first; the reset below would only forget it locally.
        await disconnectChatgpt().catch(() => undefined);
      }
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
      setExplainEnabled(nextSettings.explainEnabled);
      setSavedSettings(snapshotOf(nextSettings));
      applySubscriptionState(nextSettings);
      _connectionStatusCache = null;
      setConnectionStatus(idleStatusFor(nextSettings));
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
      docs: "https://github.com/balazsotakomaiya/pupil/wiki",
      github: "https://github.com/balazsotakomaiya/pupil",
      issues: "https://github.com/balazsotakomaiya/pupil/issues",
    };

    openUrl(urls[kind]);
  }

  async function handleSaveStudySettings(newCardsLimit: number | null) {
    await onSaveStudySettings(newCardsLimit);
  }

  const apiKeyHint = hasStoredApiKey
    ? "Leave empty to keep your saved key."
    : "Your key is saved securely on this device.";
  const hasUnsavedChanges =
    apiKeyEdited ||
    hasStoredApiKey !== savedSettings.hasApiKey ||
    baseUrl !== savedSettings.baseUrl ||
    model !== savedSettings.model ||
    maxTokens !== savedSettings.maxTokens ||
    temperature !== savedSettings.temperature ||
    explainEnabled !== savedSettings.explainEnabled;
  const isSettingsBusy = isSavingSettings || isTestingConnection;
  const canTestConnection =
    connection === "apiKey" ||
    (connection === "chatgpt" && chatgptState.status === "connected" && chatgptState.planUsage) ||
    (connection === "claudeCode" && claudeCode.ready);
  const areSettingsActionsBusy = isSavingSettings || isTestingConnection;

  return (
    <div className={`page ${styles.settingsPage}`}>
      <section className={styles.settingsHeader}>
        <h1 className={styles.settingsTitle}>Settings</h1>
        <p className={styles.settingsDesc}>Make Pupil yours.</p>
      </section>

      <SettingsNav activeSection={activeSection} onSelect={handleSelectSection} />

      <div
        role="tabpanel"
        id="settings-panel-general"
        aria-labelledby="settings-tab-general"
        hidden={activeSection !== "general"}
      >
        <section className={styles.settingsSection} id="appearance">
          <div className={styles.settingsSectionHead}>
            <div className={styles.settingsSectionTitle}>Appearance</div>
            <div className={styles.settingsSectionDesc}>Set the tone for your study sessions.</div>
          </div>

          <AppearanceSettingsCard />
        </section>

        <div className="ruler-divider" />

        <section className={styles.settingsSection} id="study">
          <div className={styles.settingsSectionHead}>
            <div className={styles.settingsSectionTitle}>New Cards Per Day</div>
            <div className={styles.settingsSectionDesc}>
              Set your daily pace. Due reviews always stay in the queue.
            </div>
          </div>

          <StudySettingsCard
            isSaving={isSavingStudySettings}
            onSave={handleSaveStudySettings}
            settings={studySettings}
          />
        </section>

        <div className="ruler-divider" />

        <section className={styles.settingsSection} id="shortcuts">
          <div className={styles.settingsSectionHead}>
            <div className={styles.settingsSectionTitle}>Keyboard Shortcuts</div>
            <div className={styles.settingsSectionDesc}>
              Active during study sessions and general navigation.
            </div>
          </div>

          <SettingsShortcutsGrid items={SHORTCUTS} />
        </section>
      </div>

      <div
        role="tabpanel"
        id="settings-panel-ai"
        aria-labelledby="settings-tab-ai"
        hidden={activeSection !== "ai"}
      >
        <section className={styles.settingsSection} id="ai">
          <div className={styles.settingsSectionHead}>
            <div className={styles.settingsSectionTitle}>AI Connection</div>
            <div className={styles.settingsSectionDesc}>
              {isTauriRuntime()
                ? "Choose how Pupil reaches a model for card generation and study explanations."
                : "Generation and explanations run in Pupil for desktop."}
            </div>
          </div>

          {isTauriRuntime() ? (
            <div className={styles.settingsFieldGroup}>
              <SettingsAiConnectionPicker
                disabled={isSettingsBusy || !isAiLoaded}
                onChange={handleConnectionChange}
                value={connection}
              />
              {connection === "chatgpt" ? (
                <SettingsChatgptPanel
                  disabled={isSettingsBusy}
                  model={chatgptState.model}
                  onModelChange={(nextModel) => {
                    setChatgptState((current) => ({ ...current, model: nextModel }));
                    void saveSubscriptionChoice({ chatgptModel: nextModel });
                  }}
                  onOpenUrl={(url) => void openUrl(url)}
                  onSettingsChanged={(settings) => {
                    markSettingsEdited();
                    applySubscriptionState(settings);
                  }}
                  state={chatgptState}
                />
              ) : null}
              {connection === "claudeCode" ? (
                <SettingsClaudeCodePanel
                  disabled={isSettingsBusy}
                  model={claudeCode.model}
                  onModelChange={(nextModel) => {
                    setClaudeCode((current) => ({ ...current, model: nextModel }));
                    void saveSubscriptionChoice({ claudeCodeModel: nextModel });
                  }}
                  onOpenUrl={(url) => void openUrl(url)}
                  onPathChange={(nextPath) =>
                    void saveSubscriptionChoice({ claudeCodePath: nextPath })
                  }
                  onReadyChange={(ready) => {
                    setClaudeCode((current) =>
                      current.ready === ready ? current : { ...current, ready },
                    );
                    onAiSettingsChanged?.();
                  }}
                  path={claudeCode.path}
                />
              ) : null}
              {connection === "apiKey" ? (
                <>
                  <div className={styles.settingsField}>
                    <label className={styles.settingsFieldLabel} htmlFor="settings-base-url">
                      Base URL
                      {recentlySaved && lastSavedField === "baseUrl" && (
                        <span className={styles.settingsAutosaveBadge}>Saved</span>
                      )}
                    </label>
                    <input
                      className={`${styles.settingsTextInput} ${styles.settingsTextInputMono}`}
                      disabled={isSettingsBusy}
                      id="settings-base-url"
                      onChange={(event) => {
                        markSettingsEdited();
                        const value = event.target.value;
                        setBaseUrl(value);
                        const detectedModel = detectModelFromUrl(value);
                        if (
                          detectedModel &&
                          getProviderForBaseUrl(value)?.id !== getProviderForBaseUrl(baseUrl)?.id
                        )
                          setModel(detectedModel);
                        scheduleAutoSave("baseUrl");
                      }}
                      placeholder={DEFAULT_AI_BASE_URL}
                      type="text"
                      value={baseUrl}
                    />
                    <div className={styles.settingsFieldHint}>
                      OpenAI-compatible or Anthropic. Custom and local endpoints work too.
                    </div>
                  </div>
                  <div className={styles.settingsField}>
                    <label className={styles.settingsFieldLabel} htmlFor="settings-api-key">
                      API Key
                      <span className={styles.settingsLabelBadge}>Stored safely</span>
                    </label>
                    <div className={styles.settingsKeyInputWrap}>
                      <div className={styles.settingsKeyFieldWrap}>
                        <input
                          className={`${styles.settingsTextInput} ${styles.settingsTextInputMono}`}
                          disabled={isSettingsBusy}
                          id="settings-api-key"
                          onChange={(event) => {
                            markSettingsEdited();
                            const value = event.target.value;
                            setApiKey(value);
                            setApiKeyEdited(true);
                            const provider = detectProviderFromKey(value);
                            if (
                              provider &&
                              provider.baseUrl !== baseUrl &&
                              baseUrl === DEFAULT_AI_BASE_URL &&
                              !hasStoredApiKey
                            ) {
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
                          className={styles.settingsKeyReveal}
                          disabled={isSettingsBusy}
                          onClick={() => setShowApiKey((current) => !current)}
                          type="button"
                        >
                          {showApiKey ? <EyeClosedIcon /> : <EyeOpenIcon />}
                        </button>
                      </div>
                    </div>
                    <div className={styles.settingsFieldHint}>{apiKeyHint}</div>
                  </div>
                  <SettingsModelPicker
                    baseUrl={baseUrl}
                    apiKey={apiKeyEdited ? apiKey : undefined}
                    autoDiscover={
                      activeSection === "ai" &&
                      baseUrl === loadedBaseUrl &&
                      !hasUnsavedChanges &&
                      hasStoredApiKey
                    }
                    disabled={isSettingsBusy}
                    model={model}
                    saved={recentlySaved && lastSavedField === "model"}
                    onChange={(nextModel) => {
                      markSettingsEdited();
                      setModel(nextModel);
                      scheduleAutoSave("model");
                    }}
                  />
                </>
              ) : null}
              <div className={styles.settingsConnectionActions}>
                <div className={styles.settingsKeyActions}>
                  {connection === "apiKey" ? (
                    <button
                      className={styles.settingsKeySaveBtn}
                      disabled={areSettingsActionsBusy || !hasUnsavedChanges}
                      onClick={() => void handleSaveSettings()}
                      type="button"
                    >
                      {isSavingSettings ? "Saving…" : "Save settings"}
                    </button>
                  ) : null}
                  <button
                    className={styles.settingsKeyTestBtn}
                    disabled={areSettingsActionsBusy || !canTestConnection}
                    onClick={() => void handleTestConnection()}
                    type="button"
                  >
                    <ArrowRightIcon />
                    {isTestingConnection ? "Testing…" : "Test connection"}
                  </button>
                </div>
              </div>
              <SettingsConnectionStatus
                detail={connectionStatus.detail}
                kind={connectionStatus.kind}
                label={connectionStatus.label}
              />
              <div className="ruler-divider" />
              <div className={styles.settingsToggleRow}>
                <div className={styles.settingsToggleText}>
                  <span className={styles.settingsToggleLabel}>
                    Show "Explain in detail" during study
                  </span>
                  <span className={styles.settingsToggleHint}>
                    Get a deeper explanation after revealing a card.
                  </span>
                </div>
                <button
                  aria-label={
                    explainEnabled
                      ? "Disable explain in detail button"
                      : "Enable explain in detail button"
                  }
                  aria-pressed={explainEnabled}
                  className={`${styles.settingsToggleSwitch}${explainEnabled ? ` ${styles.on}` : ""}`}
                  disabled={isSettingsBusy}
                  onClick={() => {
                    markSettingsEdited();
                    setExplainEnabled((current) => {
                      const next = !current;
                      setLastSavedField(null);
                      if (autoSaveTimerRef.current !== null) {
                        window.clearTimeout(autoSaveTimerRef.current);
                      }
                      autoSaveTimerRef.current = window.setTimeout(() => {
                        autoSaveTimerRef.current = null;
                        handleAutoSave.current();
                      }, 400);
                      return next;
                    });
                  }}
                  type="button"
                />
              </div>
              {connection !== "chatgpt" ? (
                <div>
                  <button
                    className={`${styles.settingsAdvancedToggle}${advancedOpen ? ` ${styles.open}` : ""}`}
                    aria-expanded={advancedOpen}
                    aria-controls="settings-generation-options"
                    onClick={() => setAdvancedOpen((current) => !current)}
                    type="button"
                  >
                    <ChevronRightIcon />
                    Generation options
                  </button>

                  <div
                    id="settings-generation-options"
                    className={`${styles.settingsAdvancedFields}${advancedOpen ? ` ${styles.open}` : ""}`}
                  >
                    <div className={styles.settingsFieldRow}>
                      <div className={styles.settingsField}>
                        <label className={styles.settingsFieldLabel} htmlFor="settings-max-tokens">
                          Max Tokens
                          {recentlySaved && lastSavedField === "maxTokens" && (
                            <span className={styles.settingsAutosaveBadge}>Saved</span>
                          )}
                        </label>
                        <input
                          className={`${styles.settingsTextInput} ${styles.settingsTextInputMono}`}
                          disabled={isSettingsBusy}
                          id="settings-max-tokens"
                          onChange={(event) => {
                            markSettingsEdited();
                            setMaxTokens(event.target.value);
                            scheduleAutoSave("maxTokens");
                          }}
                          placeholder="4096"
                          type="text"
                          value={maxTokens}
                        />
                      </div>

                      {connection === "apiKey" ? (
                        <div className={styles.settingsField}>
                          <label
                            className={styles.settingsFieldLabel}
                            htmlFor="settings-temperature"
                          >
                            Temperature
                            {recentlySaved && lastSavedField === "temperature" && (
                              <span className={styles.settingsAutosaveBadge}>Saved</span>
                            )}
                          </label>
                          <input
                            className={`${styles.settingsTextInput} ${styles.settingsTextInputMono}`}
                            disabled={isSettingsBusy || !supportsCustomTemperature(model)}
                            id="settings-temperature"
                            onChange={(event) => {
                              markSettingsEdited();
                              setTemperature(event.target.value);
                              scheduleAutoSave("temperature");
                            }}
                            placeholder="0.0 – 2.0"
                            type="text"
                            value={temperature}
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className={styles.settingsFieldHint}>
                      {connection === "claudeCode"
                        ? "Claude Code chooses its own sampling; only the output limit is sent."
                        : supportsCustomTemperature(model)
                          ? "Lower temperature produces more predictable cards. Higher adds variety."
                          : "This model controls its own sampling; temperature is not sent."}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <DesktopAiNotice layout="section" />
          )}
        </section>
      </div>

      <div
        role="tabpanel"
        id="settings-panel-data"
        aria-labelledby="settings-tab-data"
        hidden={activeSection !== "data"}
      >
        <section className={styles.settingsSection} id="data">
          <div className={styles.settingsSectionHead}>
            <div className={styles.settingsSectionTitle}>Data</div>
            <div className={styles.settingsSectionDesc}>
              Back up your collection or export your review history.
            </div>
          </div>

          <div className={styles.settingsDataSectionBody}>
            <div className={styles.settingsDataCards}>
              <SettingsDataCard
                action={
                  <button
                    className={styles.settingsDataBtn}
                    disabled={isExportingDatabase}
                    onClick={() => void handleExportDatabase()}
                    type="button"
                  >
                    <DownloadIcon />
                    {isExportingDatabase ? "Exporting…" : "Export"}
                  </button>
                }
                description={
                  isTauriRuntime()
                    ? "A complete SQLite backup of your collection and study progress."
                    : "A JSON backup of your spaces, cards, and study progress."
                }
                title="Collection backup"
                value={
                  <>
                    <strong>{spacesCount}</strong> spaces · <strong>{cardsCount}</strong> cards
                  </>
                }
              />

              <SettingsDataCard
                action={
                  <button
                    className={styles.settingsDataBtn}
                    disabled={isExportingReviewLogs}
                    onClick={() => void handleExportReviewLogs()}
                    type="button"
                  >
                    <DownloadIcon />
                    {isExportingReviewLogs ? "Exporting…" : "Export CSV"}
                  </button>
                }
                description="One CSV row per review, ready for your own analysis."
                title="Review history"
                value={
                  <>
                    <strong>{reviewLogCount}</strong> reviews
                  </>
                }
              />

              <SettingsDataCard
                action={
                  isTauriRuntime() ? (
                    <button
                      className={styles.settingsDataBtn}
                      onClick={() => void handleCopyPath()}
                      type="button"
                    >
                      <CopyIcon />
                      {copyState === "copied" ? "Copied" : "Copy"}
                    </button>
                  ) : null
                }
                description={
                  <span className={styles.settingsDataCardDescPath}>{databasePath}</span>
                }
                title="Storage location"
              />

              <SettingsDataCard
                action={
                  <button
                    className={`${styles.settingsDataBtn} ${styles.danger}`}
                    disabled={isResettingData}
                    onClick={() => void handleReset()}
                    type="button"
                  >
                    <TrashIcon />
                    {isResettingData ? "Resetting…" : "Reset"}
                  </button>
                }
                description="Delete all spaces, cards, review history, saved AI settings, the stored API key, and the ChatGPT connection from this device."
                title="Reset this device"
                tone="danger"
              />
            </div>

            {dataStatus.kind !== "idle" && (
              <SettingsConnectionStatus
                detail={dataStatus.detail}
                kind={dataStatus.kind}
                label={dataStatus.label}
              />
            )}
          </div>
        </section>
      </div>

      <div
        role="tabpanel"
        id="settings-panel-about"
        aria-labelledby="settings-tab-about"
        hidden={activeSection !== "about"}
      >
        <section className={styles.settingsSection} id="about">
          <div className={styles.settingsSectionHead}>
            <div className={styles.settingsSectionTitle}>About</div>
          </div>

          <SettingsAboutCard
            onOpenDocs={() => handleOpenExternal("docs")}
            onOpenGithub={() => handleOpenExternal("github")}
            onOpenIssues={() => handleOpenExternal("issues")}
          />
        </section>
      </div>

      <div className="page-end" />
    </div>
  );
}
