import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
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

export function SettingsScreen({
  cardsCount,
  onResetAllData,
  spacesCount,
}: SettingsScreenProps) {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("ai");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyEdited, setApiKeyEdited] = useState(false);
  const [hasStoredApiKey, setHasStoredApiKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [model, setModel] = useState("gpt-5.4");
  const [maxTokens, setMaxTokens] = useState("4096");
  const [temperature, setTemperature] = useState("0.7");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [databasePath, setDatabasePath] = useState("Loading database path…");
  const [reviewLogCount, setReviewLogCount] = useState(0);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isExportingDatabase, setIsExportingDatabase] = useState(false);
  const [isExportingReviewLogs, setIsExportingReviewLogs] = useState(false);
  const [isResettingData, setIsResettingData] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    detail?: string;
    kind: "idle" | "success" | "error";
    label: string;
  }>({
    detail: "Checking local provider settings…",
    kind: "idle",
    label: "Not tested",
  });
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

    async function loadState() {
      try {
        const [settings, dataSummary] = await Promise.all([
          loadAiSettings(),
          getSettingsDataSummary(),
        ]);

        if (cancelled) {
          return;
        }

        setApiKey("");
        setApiKeyEdited(false);
        setHasStoredApiKey(settings.hasApiKey);
        setBaseUrl(settings.baseUrl);
        setModel(settings.model);
        setMaxTokens(settings.maxTokens);
        setTemperature(settings.temperature);
        setDatabasePath(dataSummary.databasePath);
        setReviewLogCount(dataSummary.reviewLogCount);
        setConnectionStatus({
          detail: settings.hasApiKey ? "API key stored securely on this device" : "No saved API key yet",
          kind: "idle",
          label: "Not tested",
        });
      } catch (error: unknown) {
        if (!cancelled) {
          setConnectionStatus({
            detail: error instanceof Error ? error.message : "Failed to load AI settings.",
            kind: "error",
            label: "Load failed",
          });
          setDataStatus({
            detail: error instanceof Error ? error.message : "Failed to load data actions.",
            kind: "error",
            label: "Load failed",
          });
        }
      } finally {
        if (!cancelled) {
          setSettingsLoaded(true);
        }
      }
    }

    void loadState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveAiSettings({
        apiKey: apiKeyEdited ? apiKey : undefined,
        baseUrl,
        model,
        maxTokens,
        temperature,
      })
        .then((saved) => {
          setHasStoredApiKey(saved.hasApiKey);
        })
        .catch(() => {
          // Keep the draft state in place; generation and test flows surface validation errors explicitly.
        });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [apiKey, apiKeyEdited, baseUrl, model, maxTokens, settingsLoaded, temperature]);

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

  async function handleTestConnection() {
    setIsTestingConnection(true);

    try {
      const result = await testAiProviderConnection({
        apiKey: apiKeyEdited ? apiKey : undefined,
        baseUrl,
        model,
        maxTokens,
        temperature,
      });
      setConnectionStatus({
        detail: result.detail,
        kind: "success",
        label: result.label,
      });
    } catch (error: unknown) {
      setConnectionStatus({
        detail: error instanceof Error ? error.message : "Connection test failed.",
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
        detail: error instanceof Error ? error.message : "Database export failed.",
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
        detail: error instanceof Error ? error.message : "Review log export failed.",
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
      setApiKey("");
      setApiKeyEdited(false);
      setHasStoredApiKey(nextSettings.hasApiKey);
      setBaseUrl(nextSettings.baseUrl);
      setModel(nextSettings.model);
      setMaxTokens(nextSettings.maxTokens);
      setTemperature(nextSettings.temperature);
      setConnectionStatus({
        detail: nextSettings.hasApiKey ? "API key stored securely on this device" : "No saved API key yet",
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
        detail: error instanceof Error ? error.message : "Reset failed.",
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
    ? "API key stored in Stronghold. Leave the field empty to keep it, or clear it to remove it."
    : "API key is stored in Stronghold on this device. Add one to enable live generation.";

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
            Pupil stores the API key in Stronghold and keeps the non-secret provider settings in the
            local app database. Generation and provider tests now use these saved values directly.
          </div>
        </div>

        <div className="settings-field-group">
          <div className="settings-field">
            <label className="settings-field-label" htmlFor="settings-api-key">
              API Key
              <span className="settings-label-badge">Stronghold</span>
            </label>
            <div className="settings-key-input-wrap">
              <input
                className="settings-text-input settings-text-input-mono"
                id="settings-api-key"
                onChange={(event) => {
                  setApiKey(event.target.value);
                  setApiKeyEdited(true);
                }}
                placeholder={hasStoredApiKey ? "Stored securely — enter a new key to replace it" : "sk-..."}
                type={showApiKey ? "text" : "password"}
                value={apiKey}
              />
              <button
                aria-label={showApiKey ? "Hide API key" : "Show API key"}
                className="settings-key-reveal"
                onClick={() => setShowApiKey((current) => !current)}
                type="button"
              >
                {showApiKey ? <EyeClosedIcon /> : <EyeOpenIcon />}
              </button>
              <button
                className="settings-key-test-btn"
                disabled={isTestingConnection}
                onClick={() => void handleTestConnection()}
                type="button"
              >
                <ArrowRightIcon />
                {isTestingConnection ? "Testing…" : "Test"}
              </button>
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
            </label>
            <input
              className="settings-text-input settings-text-input-mono"
              id="settings-base-url"
              onChange={(event) => setBaseUrl(event.target.value)}
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
            </label>
            <input
              className="settings-text-input settings-text-input-mono"
              id="settings-model"
              onChange={(event) => setModel(event.target.value)}
              placeholder="Enter model name"
              type="text"
              value={model}
            />
            <div className="settings-model-chips">
              {["gpt-5.4", "claude-sonnet-4-6", "claude-opus-4-6"].map((chip) => (
                <button
                  className={`settings-model-chip${model === chip ? " active" : ""}`}
                  key={chip}
                  onClick={() => setModel(chip)}
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
                  </label>
                  <input
                    className="settings-text-input settings-text-input-mono"
                    id="settings-max-tokens"
                    onChange={(event) => setMaxTokens(event.target.value)}
                    placeholder="4096"
                    type="text"
                    value={maxTokens}
                  />
                </div>

                <div className="settings-field">
                  <label className="settings-field-label" htmlFor="settings-temperature">
                    Temperature
                  </label>
                  <input
                    className="settings-text-input settings-text-input-mono"
                    id="settings-temperature"
                    onChange={(event) => setTemperature(event.target.value)}
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
