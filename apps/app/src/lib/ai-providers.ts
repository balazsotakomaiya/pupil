export type AiProviderConfig = {
  id: string;
  label: string;
  baseUrl: string;
  baseUrlMatch: string;
  keyPrefixes: readonly string[];
  defaultModel: string;
  recommendedModels: readonly string[];
};

export const AI_PROVIDERS: readonly AiProviderConfig[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    baseUrlMatch: "openai.com",
    keyPrefixes: ["sk-"],
    defaultModel: "gpt-5.6-terra",
    recommendedModels: ["gpt-5.6-terra", "gpt-5.6-luna", "gpt-6-astra", "gpt-5.6-sol"],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    baseUrlMatch: "anthropic.com",
    keyPrefixes: ["sk-ant-"],
    defaultModel: "claude-sonnet-5",
    recommendedModels: ["claude-sonnet-5", "claude-opus-5", "claude-haiku-4-5", "claude-fable-5-1"],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    baseUrlMatch: "generativelanguage.googleapis.com",
    keyPrefixes: ["AIza"],
    defaultModel: "gemini-3.8-flash",
    recommendedModels: ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.1-pro-preview"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    baseUrlMatch: "openrouter.ai",
    keyPrefixes: ["sk-or-v1-", "sk-or-"],
    defaultModel: "anthropic/claude-sonnet-5",
    recommendedModels: [
      "anthropic/claude-opus-5",
      "anthropic/claude-sonnet-5",
      "openai/gpt-5.6-terra",
      "google/gemini-3.8-flash",
      "z-ai/glm-5.2",
      "deepseek/deepseek-v4-pro",
    ],
  },
];

export const DEFAULT_AI_BASE_URL = AI_PROVIDERS[0].baseUrl;
export const DEFAULT_AI_MODEL = AI_PROVIDERS[0].defaultModel;

export function getProviderForBaseUrl(baseUrl: string): AiProviderConfig | null {
  if (!baseUrl) return null;
  try {
    const host = new URL(baseUrl).hostname;
    return (
      AI_PROVIDERS.find(
        (provider) => host === provider.baseUrlMatch || host.endsWith(`.${provider.baseUrlMatch}`),
      ) ?? null
    );
  } catch {
    return null;
  }
}

export function getProviderForKey(key: string): AiProviderConfig | null {
  if (key.length < 10) return null;
  let best: AiProviderConfig | null = null;
  let bestPrefixLength = 0;
  for (const provider of AI_PROVIDERS) {
    for (const prefix of provider.keyPrefixes) {
      if (key.startsWith(prefix) && prefix.length > bestPrefixLength) {
        best = provider;
        bestPrefixLength = prefix.length;
      }
    }
  }
  return best;
}

export function getDefaultModelForBaseUrl(baseUrl: string): string {
  return getProviderForBaseUrl(baseUrl)?.defaultModel ?? DEFAULT_AI_MODEL;
}

export function getRecommendedModelsForBaseUrl(baseUrl: string): string[] {
  const provider = getProviderForBaseUrl(baseUrl);
  return provider ? [...provider.recommendedModels] : [...AI_PROVIDERS[0].recommendedModels];
}

export function supportsCustomTemperature(model: string): boolean {
  const id = model.split("/").at(-1) ?? model;
  return ![
    "gpt-5",
    "gpt-6",
    "o1",
    "o3",
    "o4",
    "claude-sonnet-5",
    "claude-opus-5",
    "claude-fable-5",
  ].some((prefix) => id.startsWith(prefix));
}
