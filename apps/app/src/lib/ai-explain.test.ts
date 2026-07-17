import { describe, expect, it } from "vitest";
import { enableTauriRuntime, invokeMock } from "../test/tauri";
import { explainCard, normalizeExplainCardResult } from "./ai-explain";

const payload = {
  schemaVersion: 1,
  paragraphs: ["First paragraph.", "Second paragraph.", "Third paragraph."],
  visual: null,
};

describe("AI explanations", () => {
  it("requires the desktop runtime before invoking the explanation command", async () => {
    await expect(explainCard({ cardId: "card-a" })).rejects.toThrow(
      "AI explanations require the desktop app",
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("normalizes a valid desktop explanation and sends a default force flag", async () => {
    enableTauriRuntime();
    const result = { cached: true, generatedAt: 123, payload };
    invokeMock.mockResolvedValueOnce(result);

    await expect(explainCard({ cardId: "card-a" })).resolves.toEqual(result);
    expect(invokeMock).toHaveBeenCalledWith("explain_card", {
      input: { cardId: "card-a", force: false },
    });
  });

  it("rejects malformed explanation responses", () => {
    expect(() => normalizeExplainCardResult(null)).toThrow("The explanation response was invalid.");
    expect(() => normalizeExplainCardResult({ cached: true, generatedAt: 1, payload: {} })).toThrow(
      "The explanation response was invalid.",
    );
  });
});
