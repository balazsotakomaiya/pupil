import { type ExplainCardPayload, isExplainCardPayload } from "./ai-explanation";
import { invokeCommand } from "./ipc";
import { isTauriRuntime } from "./runtime";

export type { ExplainCardPayload } from "./ai-explanation";

export type ExplainCardResult = {
  cached: boolean;
  explanation: string;
  generatedAt: number;
  payload: ExplainCardPayload;
};

export async function explainCard(input: {
  cardId: string;
  force?: boolean;
}): Promise<ExplainCardResult> {
  if (isTauriRuntime()) {
    const result = await invokeCommand<unknown>("explain_card", {
      input: { cardId: input.cardId, force: input.force ?? false },
    });
    return normalizeExplainCardResult(result);
  }

  throw new Error("AI explanations require the desktop app with an AI key configured.");
}

export function normalizeExplainCardResult(value: unknown): ExplainCardResult {
  if (!value || typeof value !== "object") throw new Error("The explanation response was invalid.");
  const result = value as Partial<ExplainCardResult> & { payload?: unknown };
  const explanation = typeof result.explanation === "string" ? result.explanation : "";
  const payload = isExplainCardPayload(result.payload) ? result.payload : null;
  if (!payload || typeof result.generatedAt !== "number" || typeof result.cached !== "boolean") {
    throw new Error("The explanation response was invalid.");
  }
  return {
    cached: result.cached,
    explanation: explanation || payload.paragraphs.join("\n\n"),
    generatedAt: result.generatedAt,
    payload,
  };
}
