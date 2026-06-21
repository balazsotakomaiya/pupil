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
    defaultModel: "gpt-5.5",
    recommendedModels: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    baseUrlMatch: "anthropic.com",
    keyPrefixes: ["sk-ant-"],
    defaultModel: "claude-sonnet-4-6",
    recommendedModels: ["claude-sonnet-4-6", "claude-opus-4-8", "claude-haiku-4-5"],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    baseUrlMatch: "generativelanguage.googleapis.com",
    keyPrefixes: ["AIza"],
    defaultModel: "gemini-3.1-pro-preview",
    recommendedModels: ["gemini-3.1-pro-preview", "gemini-3.5-flash"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    baseUrlMatch: "openrouter.ai",
    keyPrefixes: ["sk-or-v1-", "sk-or-"],
    defaultModel: "anthropic/claude-opus-4.8",
    recommendedModels: [
      "anthropic/claude-opus-4.8",
      "anthropic/claude-sonnet-4.6",
      "openai/gpt-5.5",
      "google/gemini-3.1-pro-preview",
      "zhipuai/glm-5.2",
      "deepseek/deepseek-v4-pro",
    ],
  },
];

export const DEFAULT_AI_BASE_URL = AI_PROVIDERS[0].baseUrl;
export const DEFAULT_AI_MODEL = AI_PROVIDERS[0].defaultModel;

export function getProviderForBaseUrl(baseUrl: string): AiProviderConfig | null {
  if (!baseUrl) return null;
  return AI_PROVIDERS.find((provider) => baseUrl.includes(provider.baseUrlMatch)) ?? null;
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
