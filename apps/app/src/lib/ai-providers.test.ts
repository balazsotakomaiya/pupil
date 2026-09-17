import { describe, expect, it } from "vitest";
import {
  AI_PROVIDERS,
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  getDefaultModelForBaseUrl,
  getProviderForBaseUrl,
  getProviderForKey,
  getRecommendedModelsForBaseUrl,
} from "./ai-providers";

describe("AI_PROVIDERS", () => {
  it("lists OpenAI first so it anchors the default fallback", () => {
    expect(AI_PROVIDERS[0].id).toBe("openai");
    expect(DEFAULT_AI_BASE_URL).toBe("https://api.openai.com/v1");
    expect(DEFAULT_AI_MODEL).toBe(AI_PROVIDERS[0].defaultModel);
  });

  it("gives every provider a non-empty recommended model list", () => {
    for (const provider of AI_PROVIDERS) {
      expect(provider.recommendedModels.length).toBeGreaterThan(0);
      expect(provider.recommendedModels).toContain(provider.defaultModel);
    }
  });
});

describe("getProviderForBaseUrl", () => {
  it("matches known provider hosts", () => {
    expect(getProviderForBaseUrl("https://api.openai.com/v1")?.id).toBe("openai");
    expect(getProviderForBaseUrl("https://api.anthropic.com/v1")?.id).toBe("anthropic");
    expect(
      getProviderForBaseUrl("https://generativelanguage.googleapis.com/v1beta/openai")?.id,
    ).toBe("gemini");
    expect(getProviderForBaseUrl("https://openrouter.ai/api/v1")?.id).toBe("openrouter");
  });

  it("does not match a provider name in an unrelated URL path or host", () => {
    expect(getProviderForBaseUrl("https://example.com/openai.com")).toBeNull();
    expect(getProviderForBaseUrl("https://openai.com.example.com/v1")).toBeNull();
  });

  it("returns null for an unknown or empty base URL", () => {
    expect(getProviderForBaseUrl("https://api.example.com/v1")).toBeNull();
    expect(getProviderForBaseUrl("")).toBeNull();
  });
});

describe("getProviderForKey", () => {
  it("detects OpenAI keys by the sk- prefix", () => {
    expect(getProviderForKey("sk-abcdefghij123")?.id).toBe("openai");
  });

  it("detects Anthropic keys before OpenAI because sk-ant- is more specific", () => {
    expect(getProviderForKey("sk-ant-api03-abcdefghij")?.id).toBe("anthropic");
  });

  it("detects Google Gemini keys by the AIza prefix", () => {
    expect(getProviderForKey("AIzaSyABCDEFGH123")?.id).toBe("gemini");
  });

  it("detects OpenRouter keys by the sk-or- prefix", () => {
    expect(getProviderForKey("sk-or-v1-abcdefghij123")?.id).toBe("openrouter");
    expect(getProviderForKey("sk-or-abcdefghij123")?.id).toBe("openrouter");
  });

  it("ignores keys that are too short to be real", () => {
    expect(getProviderForKey("sk-")).toBeNull();
    expect(getProviderForKey("AIza")).toBeNull();
  });

  it("returns null for unknown key shapes", () => {
    expect(getProviderForKey("not-a-real-key-1234567890")).toBeNull();
  });
});

describe("getDefaultModelForBaseUrl", () => {
  it("returns the provider default when the base URL is known", () => {
    expect(getDefaultModelForBaseUrl("https://api.anthropic.com/v1")).toBe("claude-sonnet-5");
    expect(
      getDefaultModelForBaseUrl("https://generativelanguage.googleapis.com/v1beta/openai"),
    ).toBe("gemini-3.8-flash");
    expect(getDefaultModelForBaseUrl("https://openrouter.ai/api/v1")).toBe(
      "anthropic/claude-sonnet-5",
    );
  });

  it("falls back to the default model for unknown base URLs", () => {
    expect(getDefaultModelForBaseUrl("https://api.example.com/v1")).toBe(DEFAULT_AI_MODEL);
    expect(getDefaultModelForBaseUrl("")).toBe(DEFAULT_AI_MODEL);
  });
});

describe("getRecommendedModelsForBaseUrl", () => {
  it("returns the matching provider's recommended models", () => {
    const models = getRecommendedModelsForBaseUrl("https://api.anthropic.com/v1");
    expect(models).toContain("claude-sonnet-5");
    expect(models).toContain("claude-opus-5");
  });

  it("falls back to the default provider's models for unknown base URLs", () => {
    const models = getRecommendedModelsForBaseUrl("https://my-proxy.example.com/v1");
    expect(models).toEqual([...AI_PROVIDERS[0].recommendedModels]);
  });

  it("returns a fresh array so callers cannot mutate the config", () => {
    const first = getRecommendedModelsForBaseUrl("https://api.openai.com/v1");
    first.push("mutated");
    const second = getRecommendedModelsForBaseUrl("https://api.openai.com/v1");
    expect(second).not.toContain("mutated");
  });
});
