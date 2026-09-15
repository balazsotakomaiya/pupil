import { getProviderForBaseUrl, getRecommendedModelsForBaseUrl } from "./ai-providers";
import { invokeCommand } from "./ipc";
import { isTauriRuntime } from "./runtime";
import { withTimeout } from "./timeout";

export type AiModelCatalog = { models: string[]; popular: boolean };

export async function discoverAiModels(input: {
  baseUrl: string;
  apiKey?: string;
}): Promise<AiModelCatalog> {
  if (!isTauriRuntime()) {
    throw new Error("Model discovery is available in the desktop app.");
  }
  return withTimeout(
    invokeCommand<AiModelCatalog>("list_ai_models", { input }),
    16000,
    "Loading provider models",
  );
}

export function orderDiscoveredModels(baseUrl: string, catalog: AiModelCatalog): string[] {
  const models = [...new Set(catalog.models.filter((model) => model.trim()))];
  if (catalog.popular) return models;
  const recommendations = getRecommendedModelsForBaseUrl(baseUrl);
  // Unknown endpoints may serve completely different model families.
  if (!getProviderForBaseUrl(baseUrl))
    return models.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return [
    ...recommendations.filter((model) => models.includes(model)),
    ...models
      .filter((model) => !recommendations.includes(model))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true })),
  ];
}
