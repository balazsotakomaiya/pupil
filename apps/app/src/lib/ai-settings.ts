import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./runtime";

export type AiDifficulty = "Beginner" | "Intermediate" | "Advanced";
export type AiStyle = "Concept" | "Q&A" | "Cloze";

export type AiSettings = {
  apiKey: string;
  hasApiKey: boolean;
  baseUrl: string;
  model: string;
  maxTokens: string;
  temperature: string;
};

export type AiConnectionTestResult = {
  detail: string;
  label: string;
};

export type GeneratedAiCard = {
  back: string;
  front: string;
};

type PersistedAiSettings = Omit<AiSettings, "apiKey">;

type SaveAiSettingsInput = {
  apiKey?: string;
  baseUrl: string;
  model: string;
  maxTokens: string;
  temperature: string;
};

const AI_SETTINGS_STORAGE_KEY = "pupil.ai.settings";

const DEFAULT_AI_SETTINGS: AiSettings = {
  apiKey: "",
  hasApiKey: false,
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-5.4",
  maxTokens: "4096",
  temperature: "0.7",
};

let pendingTauriAiSettings: Promise<AiSettings> | null = null;
const SETTINGS_COMMAND_TIMEOUT_MS = 5000;
const CONNECTION_TEST_TIMEOUT_MS = 15000;

export async function loadAiSettings(): Promise<AiSettings> {
  if (isTauriRuntime()) {
    if (!pendingTauriAiSettings) {
      pendingTauriAiSettings = withTimeout(
        invoke<PersistedAiSettings>("get_ai_settings"),
        SETTINGS_COMMAND_TIMEOUT_MS,
        "Loading local AI settings",
      )
        .then((state) => ({ ...state, apiKey: "" }))
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
      invoke<PersistedAiSettings>("save_ai_settings", { input }),
      SETTINGS_COMMAND_TIMEOUT_MS,
      "Saving local AI settings",
    );
    return {
      ...state,
      apiKey: input.apiKey ?? "",
    };
  }

  const current = readWebAiSettings();
  const nextSettings: AiSettings = {
    apiKey: input.apiKey ?? current.apiKey,
    hasApiKey:
      typeof input.apiKey === "string" ? input.apiKey.trim().length > 0 : current.hasApiKey,
    baseUrl: input.baseUrl,
    model: input.model,
    maxTokens: input.maxTokens,
    temperature: input.temperature,
  };

  writeWebAiSettings(nextSettings);
  return nextSettings;
}

export async function testAiProviderConnection(
  input: SaveAiSettingsInput,
): Promise<AiConnectionTestResult> {
  if (isTauriRuntime()) {
    return withTimeout(
      invoke<AiConnectionTestResult>("test_ai_provider_connection", { input }),
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
}): Promise<GeneratedAiCard[]> {
  if (isTauriRuntime()) {
    return invoke<GeneratedAiCard[]>("generate_cards", { input });
  }

  return buildMockGeneratedCards(input);
}

export function hasConfiguredAiKey(settings: AiSettings): boolean {
  return settings.apiKey.trim().length > 0 || settings.hasApiKey;
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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out. Please restart the app and try again.`));
    }, ms);

    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
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
