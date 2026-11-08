import { DEFAULT_AI_BASE_URL, DEFAULT_AI_MODEL } from "./ai-providers";
import { invokeCommand } from "./ipc";
import { isTauriRuntime } from "./runtime";
import { withTimeout } from "./timeout";

export type AiDifficulty = "Beginner" | "Intermediate" | "Advanced";
export type AiStyle = "Concept" | "Q&A" | "Cloze";

/** How AI requests reach a model. Each is its own transport; none falls back to another. */
export type AiConnectionKind = "apiKey" | "chatgpt" | "claudeCode";

export type ChatgptConnectionState = {
  status: "disconnected" | "connected" | "expired";
  email: string | null;
  planUsage: boolean;
  model: string;
};

export type ClaudeCodeSettings = {
  model: string;
  path: string;
  ready: boolean;
};

export type AiSettings = {
  apiKey: string;
  hasApiKey: boolean;
  baseUrl: string;
  model: string;
  maxTokens: string;
  temperature: string;
  explainEnabled: boolean;
  connection: AiConnectionKind;
  chatgpt: ChatgptConnectionState;
  claudeCode: ClaudeCodeSettings;
};

export type AiConnectionTestResult = {
  detail: string;
  label: string;
};

export type GeneratedAiCard = {
  back: string;
  front: string;
};

export type PersistedAiSettings = Omit<AiSettings, "apiKey"> & { aiReady?: boolean };

export type SaveAiSettingsInput = {
  apiKey?: string;
  baseUrl: string;
  model: string;
  maxTokens: string;
  temperature: string;
  explainEnabled?: boolean;
  connection?: AiConnectionKind;
  chatgptModel?: string;
  claudeCodeModel?: string;
  claudeCodePath?: string;
};

const AI_SETTINGS_STORAGE_KEY = "pupil.ai.settings";

export const DEFAULT_CHATGPT_MODEL = "gpt-5.6-terra";
export const DEFAULT_CLAUDE_CODE_MODEL = "opus";

export const DEFAULT_AI_SETTINGS: AiSettings = {
  apiKey: "",
  hasApiKey: false,
  baseUrl: DEFAULT_AI_BASE_URL,
  model: DEFAULT_AI_MODEL,
  maxTokens: "4096",
  temperature: "0.7",
  explainEnabled: true,
  connection: "apiKey",
  chatgpt: { status: "disconnected", email: null, planUsage: false, model: DEFAULT_CHATGPT_MODEL },
  claudeCode: { model: DEFAULT_CLAUDE_CODE_MODEL, path: "", ready: false },
};

/** Fills in fields an older backend or stored preview might not send. */
export function fromPersistedAiSettings(state: PersistedAiSettings, apiKey = ""): AiSettings {
  return {
    ...DEFAULT_AI_SETTINGS,
    ...state,
    apiKey,
    connection: state.connection ?? "apiKey",
    chatgpt: { ...DEFAULT_AI_SETTINGS.chatgpt, ...state.chatgpt },
    claudeCode: { ...DEFAULT_AI_SETTINGS.claudeCode, ...state.claudeCode },
  };
}

let pendingTauriAiSettings: Promise<AiSettings> | null = null;
const SETTINGS_COMMAND_TIMEOUT_MS = 5000;
// Claude Code starts a whole CLI session, so a test can take a few seconds
// longer than an HTTP round trip.
const CONNECTION_TEST_TIMEOUT_MS = 60000;
// Sits above the backend's own limits (90s HTTP, 180s Claude Code) so the
// clearer backend error normally wins the race; this only guarantees the UI
// cannot hang.
const GENERATE_TIMEOUT_MS = 200000;

export async function loadAiSettings(): Promise<AiSettings> {
  if (isTauriRuntime()) {
    if (!pendingTauriAiSettings) {
      pendingTauriAiSettings = withTimeout(
        invokeCommand<PersistedAiSettings>("get_ai_settings"),
        SETTINGS_COMMAND_TIMEOUT_MS,
        "Loading local AI settings",
        "Please restart the app and try again.",
      )
        .then((state) => fromPersistedAiSettings(state))
        .finally(() => {
          pendingTauriAiSettings = null;
        });
    }

    return pendingTauriAiSettings;
  }

  return readWebAiSettings();
}

export async function saveAiSettings(input: SaveAiSettingsInput): Promise<AiSettings> {
  if (isTauriRuntime()) {
    const state = await withTimeout(
      invokeCommand<PersistedAiSettings>("save_ai_settings", { input }),
      SETTINGS_COMMAND_TIMEOUT_MS,
      "Saving local AI settings",
      "Please restart the app and try again.",
    );
    return fromPersistedAiSettings(state, input.apiKey ?? "");
  }

  // The browser preview has no subscription connections; it keeps the API
  // key form only.
  const current = readWebAiSettings();
  const nextSettings: AiSettings = {
    ...current,
    apiKey: input.apiKey ?? current.apiKey,
    hasApiKey:
      typeof input.apiKey === "string" ? input.apiKey.trim().length > 0 : current.hasApiKey,
    baseUrl: input.baseUrl,
    model: input.model,
    maxTokens: input.maxTokens,
    temperature: input.temperature,
    explainEnabled: input.explainEnabled ?? current.explainEnabled,
  };

  writeWebAiSettings(nextSettings);
  return nextSettings;
}

export async function testAiProviderConnection(
  input: SaveAiSettingsInput,
): Promise<AiConnectionTestResult> {
  if (isTauriRuntime()) {
    return withTimeout(
      invokeCommand<AiConnectionTestResult>("test_ai_provider_connection", { input }),
      CONNECTION_TEST_TIMEOUT_MS,
      "Testing the AI provider connection",
    );
  }

  if (!(input.apiKey ?? "").trim()) {
    throw new Error("Add an API key first.");
  }

  return {
    detail: `${input.model} · local preview`,
    label: "Connected",
  };
}

export async function generateAiCards(input: {
  count: number | null;
  difficulty: AiDifficulty;
  style: AiStyle;
  topic: string;
  /** Lets the caller cancel the request with `cancelAiRequest`. */
  requestId?: string;
}): Promise<GeneratedAiCard[]> {
  if (isTauriRuntime()) {
    return withTimeout(
      invokeCommand<GeneratedAiCard[]>("generate_cards", { input }),
      GENERATE_TIMEOUT_MS,
      "Generating cards",
    );
  }

  return buildMockGeneratedCards(input);
}

export function hasConfiguredAiKey(settings: Pick<AiSettings, "apiKey" | "hasApiKey">): boolean {
  return settings.apiKey.trim().length > 0 || settings.hasApiKey;
}

/**
 * Whether the selected connection is set up enough to try a request. A
 * subscription connection never counts a saved API key as ready, since
 * requests would not fall back to it.
 */
export function isAiConnectionReady(settings: AiSettings): boolean {
  switch (settings.connection) {
    case "chatgpt":
      return settings.chatgpt.status === "connected" && settings.chatgpt.planUsage;
    case "claudeCode":
      return settings.claudeCode.ready;
    default:
      return hasConfiguredAiKey(settings);
  }
}

export const CLAUDE_CODE_MODELS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "opus", label: "Opus" },
  { id: "sonnet", label: "Sonnet" },
  { id: "haiku", label: "Haiku" },
];

/** The model and route shown next to AI actions, e.g. "opus · Claude plan". */
export function describeAiConnection(settings: AiSettings): { model: string; via: string } {
  switch (settings.connection) {
    case "chatgpt":
      return { model: settings.chatgpt.model, via: "ChatGPT plan" };
    case "claudeCode":
      return {
        model:
          CLAUDE_CODE_MODELS.find((model) => model.id === settings.claudeCode.model)?.label ??
          settings.claudeCode.model,
        via: "Claude plan",
      };
    default:
      return { model: settings.model, via: endpointHost(settings.baseUrl) };
  }
}

function endpointHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl.replace(/^https?:\/\//, "");
  }
}

export function describeAiSettingsError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object") {
    const maybeError = error as {
      cause?: unknown;
      detail?: unknown;
      error?: unknown;
      message?: unknown;
    };

    for (const candidate of [
      maybeError.message,
      maybeError.error,
      maybeError.detail,
      maybeError.cause,
    ]) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate;
      }
    }

    try {
      const serialized = JSON.stringify(error);

      if (serialized !== "{}") {
        return serialized;
      }
    } catch {
      // Ignore JSON serialization issues and fall through to the fallback.
    }
  }

  return fallback;
}

function readWebAiSettings(): AiSettings {
  if (typeof window === "undefined" || !window.localStorage) {
    return DEFAULT_AI_SETTINGS;
  }

  const raw = window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY);

  if (!raw) {
    return DEFAULT_AI_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    const apiKey = typeof parsed.apiKey === "string" ? parsed.apiKey : DEFAULT_AI_SETTINGS.apiKey;

    return {
      ...DEFAULT_AI_SETTINGS,
      apiKey,
      hasApiKey: apiKey.trim().length > 0,
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : DEFAULT_AI_SETTINGS.baseUrl,
      model: typeof parsed.model === "string" ? parsed.model : DEFAULT_AI_SETTINGS.model,
      maxTokens:
        typeof parsed.maxTokens === "string" ? parsed.maxTokens : DEFAULT_AI_SETTINGS.maxTokens,
      temperature:
        typeof parsed.temperature === "string"
          ? parsed.temperature
          : DEFAULT_AI_SETTINGS.temperature,
      explainEnabled:
        typeof parsed.explainEnabled === "boolean"
          ? parsed.explainEnabled
          : DEFAULT_AI_SETTINGS.explainEnabled,
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

function writeWebAiSettings(settings: AiSettings): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function buildMockGeneratedCards(input: {
  count: number | null;
  difficulty: AiDifficulty;
  style: AiStyle;
  topic: string;
}): GeneratedAiCard[] {
  const topic = input.topic.trim();
  const concepts = extractConcepts(topic);
  const count = input.count ?? Math.max(6, Math.min(18, concepts.length * 2));

  return Array.from({ length: count }, (_, index) => {
    const concept = concepts[index % concepts.length] ?? topic;
    const detail = concepts[(index + 1) % concepts.length] ?? topic;

    if (input.style === "Concept") {
      return {
        back: `${concept} is a core idea in ${topic}. ${difficultyExplanation(input.difficulty)}`,
        front: concept,
      };
    }

    if (input.style === "Cloze") {
      return {
        back: `${concept}. In ${topic}, it matters because it anchors ${detail.toLowerCase()}.`,
        front: `In ${topic}, ___ is closely tied to ${detail.toLowerCase()}.`,
      };
    }

    const promptStyles = [
      `What is ${concept}?`,
      `Why does ${concept} matter in ${topic}?`,
      `How would you explain ${concept} in one clean sentence?`,
      `What role does ${concept} play relative to ${detail.toLowerCase()}?`,
    ];

    return {
      back: `${concept} is a key part of ${topic}. ${difficultyExplanation(input.difficulty)}`,
      front: promptStyles[index % promptStyles.length],
    };
  });
}

function extractConcepts(topic: string) {
  const rawParts = topic
    .split(/[\n,;]+|\s+[/-]\s+|\s+—\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const baseParts = rawParts.length > 0 ? rawParts : [topic];
  const normalized = Array.from(
    new Set(
      baseParts
        .flatMap((part) => splitLongPart(part))
        .map((part) => part.replace(/[.?!]+$/, "").trim())
        .filter((part) => part.length > 0),
    ),
  );

  return normalized.length > 0 ? normalized : [topic];
}

function splitLongPart(part: string) {
  if (part.split(" ").length <= 5) {
    return [part];
  }

  return [
    part,
    ...part
      .split(/\s+/)
      .filter((word) => word.length > 4)
      .slice(0, 3),
  ];
}

function difficultyExplanation(difficulty: AiDifficulty) {
  switch (difficulty) {
    case "Beginner":
      return "Keep the explanation grounded and plain, with minimal jargon.";
    case "Advanced":
      return "Include the deeper mechanism, tradeoff, or edge case that makes it matter.";
    default:
      return "Aim for a precise explanation that still stays compact enough to review quickly.";
  }
}
