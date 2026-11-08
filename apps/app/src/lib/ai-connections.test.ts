import { describe, expect, it } from "vitest";
import { enableTauriRuntime, invokeMock } from "../test/tauri";
import {
  cancelAiRequest,
  cancelChatgptSignIn,
  disconnectChatgpt,
  getClaudeCodeStatus,
  listChatgptModels,
  newAiRequestId,
  pickChatgptModel,
  startChatgptSignIn,
} from "./ai-connections";

const persistedChatgpt = {
  hasApiKey: false,
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-5.6-terra",
  maxTokens: "4096",
  temperature: "0.7",
  explainEnabled: true,
  connection: "chatgpt",
  chatgpt: { status: "connected", email: "learner@example.com", planUsage: true, model: "gpt-a" },
  claudeCode: { model: "opus", path: "", ready: false },
  aiReady: true,
};

describe("subscription connections outside the desktop app", () => {
  it("refuses subscription commands without the desktop runtime", async () => {
    await expect(getClaudeCodeStatus()).rejects.toThrow("Claude subscriptions");
    await expect(startChatgptSignIn()).rejects.toThrow("ChatGPT plan usage");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("treats cancelling as a no-op in the browser", async () => {
    await expect(cancelAiRequest("generate-1")).resolves.toBe(false);
    await expect(cancelChatgptSignIn()).resolves.toBe(false);
  });
});

describe("subscription connections in the desktop app", () => {
  it("checks the saved Claude Code install when no path is given", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValue({ usable: true });
    await getClaudeCodeStatus();
    expect(invokeMock).toHaveBeenCalledWith("get_claude_code_status", { path: null });
  });

  it("returns the settings recorded after a ChatGPT sign-in, without any token", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValue(persistedChatgpt);
    const settings = await startChatgptSignIn();
    expect(invokeMock).toHaveBeenCalledWith("start_chatgpt_sign_in", undefined);
    expect(settings.chatgpt).toEqual(persistedChatgpt.chatgpt);
    expect(settings.apiKey).toBe("");
    expect(JSON.stringify(settings)).not.toMatch(/(access|refresh|id)_?token/i);
  });

  it("reports whether OpenAI confirmed the disconnect", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValue({
      remoteRevoked: false,
      settings: {
        ...persistedChatgpt,
        chatgpt: { ...persistedChatgpt.chatgpt, status: "disconnected" },
      },
    });
    const result = await disconnectChatgpt();
    expect(result.remoteRevoked).toBe(false);
    expect(result.settings.chatgpt.status).toBe("disconnected");
  });

  it("lists the account's models and cancels requests by ID", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce([{ id: "gpt-a", label: "GPT A" }]).mockResolvedValueOnce(true);
    await expect(listChatgptModels()).resolves.toEqual([{ id: "gpt-a", label: "GPT A" }]);
    await expect(cancelAiRequest("generate-1")).resolves.toBe(true);
    expect(invokeMock).toHaveBeenLastCalledWith("cancel_ai_request", { requestId: "generate-1" });
  });
});

describe("request IDs and model choice", () => {
  it("makes unique request IDs the backend accepts", () => {
    const first = newAiRequestId("generate");
    const second = newAiRequestId("generate");
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  it("keeps the saved model when the plan lists it, otherwise picks the first", () => {
    const models = [
      { id: "gpt-a", label: "A" },
      { id: "gpt-b", label: "B" },
    ];
    expect(pickChatgptModel("gpt-b", models)).toBe("gpt-b");
    expect(pickChatgptModel("gpt-gone", models)).toBe("gpt-a");
    expect(pickChatgptModel("gpt-gone", [])).toBe("gpt-gone");
  });
});
