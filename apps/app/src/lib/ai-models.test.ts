import { describe, expect, it, vi } from "vitest";
import { discoverAiModels, orderDiscoveredModels } from "./ai-models";
import { AI_PROVIDERS } from "./ai-providers";
import { invokeCommand } from "./ipc";

vi.mock("./ipc", () => ({ invokeCommand: vi.fn() }));
vi.mock("./runtime", () => ({ isTauriRuntime: () => true }));

describe("provider model discovery", () => {
  it("passes the draft endpoint and key to desktop discovery without saving settings", async () => {
    vi.mocked(invokeCommand).mockResolvedValue({ models: ["local-model"], popular: false });
    await expect(
      discoverAiModels({ baseUrl: "http://localhost:11434/v1", apiKey: "draft-key" }),
    ).resolves.toEqual({ models: ["local-model"], popular: false });
    expect(invokeCommand).toHaveBeenCalledWith("list_ai_models", {
      input: { baseUrl: "http://localhost:11434/v1", apiKey: "draft-key" },
    });
  });
  it("preserves popularity rankings and removes duplicates", () => {
    expect(
      orderDiscoveredModels("https://openrouter.ai/api/v1", {
        models: ["model-b", "model-a", "model-b"],
        popular: true,
      }),
    ).toEqual(["model-b", "model-a"]);
  });
  it("only recommends models actually available at the endpoint", () => {
    const preferred = AI_PROVIDERS[0].defaultModel;
    expect(
      orderDiscoveredModels(AI_PROVIDERS[0].baseUrl, {
        models: ["custom-1", preferred, "custom-2"],
        popular: false,
      }),
    ).toEqual([preferred, "custom-2", "custom-1"]);
  });
  it("keeps custom endpoint models without inserting OpenAI fallbacks", () => {
    expect(
      orderDiscoveredModels("http://localhost:11434/v1", {
        models: ["llama-9", "llama-10"],
        popular: false,
      }),
    ).toEqual(["llama-10", "llama-9"]);
  });
});
