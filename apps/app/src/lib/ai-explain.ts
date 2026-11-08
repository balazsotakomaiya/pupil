import {
  type ExplainCardPayload,
  isExplainCardPayload,
  sanitizeExplainPayload,
} from "./ai-explanation";
import { invokeCommand } from "./ipc";
import { isTauriRuntime } from "./runtime";
import { withTimeout } from "./timeout";

export type { ExplainCardPayload } from "./ai-explanation";

// The backend may retry a transient provider failure, and a Claude Code run
// can take up to 180s, so this allows for more than a single request while
// still bounding the spinner.
const EXPLAIN_TIMEOUT_MS = 200000;

export type ExplainCardResult = {
  cached: boolean;
  generatedAt: number;
  payload: ExplainCardPayload;
};

export async function explainCard(input: {
  cardId: string;
  force?: boolean;
  requestId?: string;
}): Promise<ExplainCardResult> {
  if (isTauriRuntime()) {
    const result = await withTimeout(
      invokeCommand<unknown>("explain_card", {
        input: {
          cardId: input.cardId,
          force: input.force ?? false,
          ...(input.requestId ? { requestId: input.requestId } : {}),
        },
      }),
      EXPLAIN_TIMEOUT_MS,
      "Explaining this card",
    );
    return normalizeExplainCardResult(result);
  }

  throw new Error("AI explanations require the desktop app with an AI connection set up.");
}

export function normalizeExplainCardResult(value: unknown): ExplainCardResult {
  if (!value || typeof value !== "object") throw new Error("The explanation response was invalid.");
  const result = value as Partial<ExplainCardResult> & { payload?: unknown };
  const payload = isExplainCardPayload(result.payload) ? result.payload : null;
  if (!payload || typeof result.generatedAt !== "number" || typeof result.cached !== "boolean") {
    throw new Error("The explanation response was invalid.");
  }
  return {
    cached: result.cached,
    generatedAt: result.generatedAt,
    payload: sanitizeExplainPayload(payload),
  };
}
