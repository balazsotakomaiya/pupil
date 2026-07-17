import { describe, expect, it } from "vitest";
import { enableTauriRuntime, invokeMock } from "../test/tauri";
import {
  describeAiSettingsError,
  generateAiCards,
  hasConfiguredAiKey,
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
        baseUrl: "",
        model: "",
        maxTokens: "",
        temperature: "",
        explainEnabled: true,
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
