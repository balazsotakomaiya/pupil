export type AiSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: string;
  temperature: string;
};

const AI_SETTINGS_STORAGE_KEY = "pupil.ai.settings";

const DEFAULT_AI_SETTINGS: AiSettings = {
  apiKey: "",
  baseUrl: "https://api.anthropic.com/v1",
  model: "claude-sonnet-4-6",
  maxTokens: "4096",
  temperature: "0.7",
};

export function readAiSettings(): AiSettings {
  if (typeof window === "undefined" || !window.localStorage) {
    return DEFAULT_AI_SETTINGS;
  }

  const raw = window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY);

  if (!raw) {
    return DEFAULT_AI_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AiSettings>;

    return {
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : DEFAULT_AI_SETTINGS.apiKey,
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

export function writeAiSettings(settings: AiSettings): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function hasConfiguredAiKey(settings: AiSettings = readAiSettings()): boolean {
  return settings.apiKey.trim().length > 0;
}
