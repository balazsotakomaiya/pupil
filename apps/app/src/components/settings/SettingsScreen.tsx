import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { readAiSettings, writeAiSettings } from "../../lib/ai-settings";
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
  spacesCount: number;
};

const DATABASE_PATH = "~/Library/Application Support/com.pupil.app/pupil.db";
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

export function SettingsScreen({ cardsCount, spacesCount }: SettingsScreenProps) {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("ai");
  const [apiKey, setApiKey] = useState(() => readAiSettings().apiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState(() => readAiSettings().baseUrl);
  const [model, setModel] = useState(() => readAiSettings().model);
  const [maxTokens, setMaxTokens] = useState(() => readAiSettings().maxTokens);
  const [temperature, setTemperature] = useState(() => readAiSettings().temperature);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [connectionStatus, setConnectionStatus] = useState<{
    detail?: string;
    kind: "idle" | "success" | "error";
    label: string;
  }>({
    detail: "Stored locally on this device",
    kind: "idle",
    label: "Not tested",
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
    writeAiSettings({
      apiKey,
      baseUrl,
      model,
      maxTokens,
      temperature,
    });
  }, [apiKey, baseUrl, model, maxTokens, temperature]);

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

  async function handleCopyPath() {
    try {
      await navigator.clipboard.writeText(DATABASE_PATH);
      setCopyState("copied");
    } catch {
      setCopyState("idle");
    }
  }

  function handleTestConnection() {
    if (!apiKey.trim()) {
      setConnectionStatus({
        detail: "Add an API key first",
        kind: "error",
        label: "Connection failed",
      });
      return;
    }

    setConnectionStatus({
      detail: `${model} · 238ms`,
      kind: "success",
      label: "Connected",
    });
  }

  function handleOpenExternal(kind: "docs" | "github" | "issues") {
    const urls = {
      docs: "https://github.com",
      github: "https://github.com",
      issues: "https://github.com/issues",
    };

    window.open(urls[kind], "_blank", "noopener,noreferrer");
  }

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
            Pupil calls an OpenAI-compatible API to generate flashcards. The visual settings flow is
            here now; Stronghold-backed secret storage and real provider testing are still part of a
            later chunk.
          </div>
        </div>

        <div className="settings-field-group">
          <div className="settings-field">
            <label className="settings-field-label" htmlFor="settings-api-key">
              API Key
              <span className="settings-label-badge">Encrypted</span>
            </label>
            <div className="settings-key-input-wrap">
              <input
                className="settings-text-input settings-text-input-mono"
                id="settings-api-key"
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="sk-..."
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
              <button className="settings-key-test-btn" onClick={handleTestConnection} type="button">
                <ArrowRightIcon />
                Test
              </button>
            </div>
            <div className="settings-field-hint">
              Target storage is Tauri Stronghold. This screen is wired for the final UX, but secure
              persistence and live provider calls are still pending.
            </div>
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
              OpenAI-compatible endpoint. Change this for Anthropic, Ollama, or a self-hosted proxy.
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
              {["claude-sonnet-4-6", "claude-opus-4-6", "gpt-5.4"].map((chip) => (
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
            All study data is stored locally. Export and destructive data actions are still UI-only
            right now.
          </div>
        </div>

        <div className="settings-data-cards">
          <SettingsDataCard
            action={
              <button className="settings-data-btn" type="button">
                <DownloadIcon />
                Export
              </button>
            }
            description="Local SQLite file containing all spaces, cards, and study metadata."
            title="Database"
            value={
              <>
                <strong>{spacesCount}</strong> spaces · <strong>{cardsCount}</strong> cards
              </>
            }
          />

          <SettingsDataCard
            action={
              <button className="settings-data-btn" type="button">
                <DownloadIcon />
                Export CSV
              </button>
            }
            description="Review logs are not recorded yet in the current build, but the UI is aligned with the final layout."
            title="Review Logs"
            value={
              <>
                <strong>0</strong> reviews
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
            description={
              <span className="settings-data-card-desc-path">{DATABASE_PATH}</span>
            }
            title="Database Path"
          />

          <SettingsDataCard
            action={
              <button className="settings-data-btn danger" type="button">
                <TrashIcon />
                Reset
              </button>
            }
            description="Delete all spaces, cards, review history, and settings. This is not wired yet and remains presentation-only."
            title="Reset All Data"
            tone="danger"
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
