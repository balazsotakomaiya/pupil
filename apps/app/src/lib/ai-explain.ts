import { invokeCommand } from "./ipc";
import { isTauriRuntime } from "./runtime";

export type ExplainCardResult = {
  cached: boolean;
  explanation: string;
  generatedAt: number;
};

export async function explainCard(input: {
  cardId: string;
  force?: boolean;
}): Promise<ExplainCardResult> {
  if (isTauriRuntime()) {
    return invokeCommand<ExplainCardResult>("explain_card", {
      input: { cardId: input.cardId, force: input.force ?? false },
    });
  }

  throw new Error("AI explanations require the desktop app with an AI key configured.");
}
