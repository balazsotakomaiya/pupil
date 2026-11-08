import { describe, expect, it } from "vitest";
import { enableTauriRuntime, invokeMock } from "../test/tauri";
import {
  type AiSettings,
  DEFAULT_AI_SETTINGS,
  describeAiConnection,
  describeAiSettingsError,
  fromPersistedAiSettings,
  generateAiCards,
  hasConfiguredAiKey,
  isAiConnectionReady,
  loadAiSettings,
  saveAiSettings,
  testAiProviderConnection,
} from "./ai-settings";

const input = {
  apiKey: "placeholder-key",
  baseUrl: "https://api.example.test/v1",
  model: "test-model",
  maxTokens: "512",
  temperature: "0.7",
  explainEnabled: false,
};
const persisted = {
  hasApiKey: true,
  baseUrl: input.baseUrl,
  model: input.model,
  maxTokens: "512",
  temperature: "0.7",
  explainEnabled: false,
};

describe("AI settings browser behavior", () => {
  it("persists browser AI settings", async () => {
    await expect(saveAiSettings(input)).resolves.toMatchObject({
      apiKey: "placeholder-key",
      explainEnabled: false,
      hasApiKey: true,
      model: "test-model",
    });
    await expect(loadAiSettings()).resolves.toMatchObject({ apiKey: "placeholder-key" });
  });
  it("rejects a local connection without a key", async () => {
    await expect(testAiProviderConnection({ ...input, apiKey: " " })).rejects.toThrow(
      "Add an API key first.",
    );
  });
  it("reports a configured API key when only its availability is persisted", () => {
    expect(
      hasConfiguredAiKey({
        apiKey: " ",
        hasApiKey: true,
      }),
    ).toBe(true);
  });
  it("describes provider errors and falls back when detail is absent", () => {
    expect(describeAiSettingsError({ detail: "Provider offline" }, "Fallback")).toBe(
      "Provider offline",
    );
    expect(describeAiSettingsError(null, "Fallback")).toBe("Fallback");
  });
  it("validates a local provider connection", async () => {
    await expect(testAiProviderConnection(input)).resolves.toEqual({
      detail: "test-model · local preview",
      label: "Connected",
    });
  });
  it("generates browser preview cards", async () => {
    await expect(
      generateAiCards({ count: 2, difficulty: "Beginner", style: "Q&A", topic: "Rust ownership" }),
    ).resolves.toHaveLength(2);
  });
});

describe("AI settings desktop commands", () => {
  it("loads persisted desktop settings without a secret key", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce(persisted);
    await expect(loadAiSettings()).resolves.toMatchObject({ apiKey: "", ...persisted });
    expect(invokeMock).toHaveBeenCalledWith("get_ai_settings", undefined);
  });
  it("returns the submitted key without writing it to browser storage", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce(persisted);
    await expect(saveAiSettings(input)).resolves.toMatchObject({
      apiKey: "placeholder-key",
      ...persisted,
    });
    expect(window.localStorage.getItem("pupil.ai.settings")).toBeNull();
    expect(invokeMock).toHaveBeenCalledWith("save_ai_settings", { input });
  });
  it("tests a desktop provider connection", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce({ detail: "ok", label: "Connected" });
    await expect(testAiProviderConnection(input)).resolves.toEqual({
      detail: "ok",
      label: "Connected",
    });
    expect(invokeMock).toHaveBeenCalledWith("test_ai_provider_connection", { input });
  });
  it("generates cards through the desktop boundary", async () => {
    enableTauriRuntime();
    const generation = {
      count: 1,
      difficulty: "Advanced" as const,
      style: "Cloze" as const,
      topic: "Ownership",
    };
    invokeMock.mockResolvedValueOnce([{ front: "Question", back: "Answer" }]);
    await expect(generateAiCards(generation)).resolves.toHaveLength(1);
    expect(invokeMock).toHaveBeenCalledWith("generate_cards", { input: generation });
  });
});

describe("AI connection readiness", () => {
  const withKey: AiSettings = { ...DEFAULT_AI_SETTINGS, hasApiKey: true };

  it("treats an API key connection as ready once a key is saved", () => {
    expect(isAiConnectionReady(withKey)).toBe(true);
    expect(isAiConnectionReady(DEFAULT_AI_SETTINGS)).toBe(false);
  });

  it("never counts a saved API key as ready for a subscription connection", () => {
    expect(isAiConnectionReady({ ...withKey, connection: "chatgpt" })).toBe(false);
    expect(isAiConnectionReady({ ...withKey, connection: "claudeCode" })).toBe(false);
  });

  it("needs ChatGPT connected with plan usage allowed", () => {
    const chatgpt = (status: AiSettings["chatgpt"]["status"], planUsage: boolean): AiSettings => ({
      ...DEFAULT_AI_SETTINGS,
      connection: "chatgpt",
      chatgpt: { ...DEFAULT_AI_SETTINGS.chatgpt, status, planUsage },
    });
    expect(isAiConnectionReady(chatgpt("connected", true))).toBe(true);
    expect(isAiConnectionReady(chatgpt("connected", false))).toBe(false);
    expect(isAiConnectionReady(chatgpt("expired", true))).toBe(false);
  });

  it("needs a passing Claude Code check", () => {
    const claude = (ready: boolean): AiSettings => ({
      ...DEFAULT_AI_SETTINGS,
      connection: "claudeCode",
      claudeCode: { ...DEFAULT_AI_SETTINGS.claudeCode, ready },
    });
    expect(isAiConnectionReady(claude(true))).toBe(true);
    expect(isAiConnectionReady(claude(false))).toBe(false);
  });

  it("labels the model and route for each connection", () => {
    expect(describeAiConnection(withKey)).toEqual({
      model: DEFAULT_AI_SETTINGS.model,
      via: "api.openai.com",
    });
    expect(describeAiConnection({ ...DEFAULT_AI_SETTINGS, connection: "claudeCode" })).toEqual({
      model: "Opus",
      via: "Claude plan",
    });
    expect(describeAiConnection({ ...DEFAULT_AI_SETTINGS, connection: "chatgpt" }).via).toBe(
      "ChatGPT plan",
    );
  });

  it("reads settings from a backend that predates subscriptions as an API key connection", () => {
    const settings = fromPersistedAiSettings({
      hasApiKey: true,
      baseUrl: "https://api.anthropic.com/v1",
      model: "claude-sonnet-5",
      maxTokens: "4096",
      temperature: "0.7",
      explainEnabled: true,
    } as never);
    expect(settings.connection).toBe("apiKey");
    expect(settings.chatgpt.status).toBe("disconnected");
    expect(isAiConnectionReady(settings)).toBe(true);
  });

  it("sends the connection choice and subscription models with a save", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValue({ ...persisted, connection: "claudeCode" });
    const saved = await saveAiSettings({
      ...input,
      connection: "claudeCode",
      claudeCodeModel: "opus",
    });
    expect(invokeMock).toHaveBeenCalledWith("save_ai_settings", {
      input: expect.objectContaining({ connection: "claudeCode", claudeCodeModel: "opus" }),
    });
    expect(saved.connection).toBe("claudeCode");
  });

  it("passes a request ID through so generation can be cancelled", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValue([{ front: "Q", back: "A" }]);
    await generateAiCards({
      count: 1,
      difficulty: "Beginner",
      style: "Q&A",
      topic: "TCP",
      requestId: "generate-1",
    });
    expect(invokeMock).toHaveBeenCalledWith("generate_cards", {
      input: expect.objectContaining({ requestId: "generate-1" }),
    });
  });
});
