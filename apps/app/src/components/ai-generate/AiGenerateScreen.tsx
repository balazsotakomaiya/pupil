import { useEffect, useState } from "react";
import {
  type AiSettings,
  generateAiCards,
  hasConfiguredAiKey,
  loadAiSettings,
} from "../../lib/ai-settings";
import type { SpaceSummary } from "../../lib/spaces";
import styles from "./AiGenerate.module.css";
import { AiGenerateError } from "./AiGenerateError";
import { AiGenerateForm, NEW_SPACE_OPTION_ID } from "./AiGenerateForm";
import { AiGenerateLoading } from "./AiGenerateLoading";
import { AiGenerateNoKey } from "./AiGenerateNoKey";
import { AiGenerateReviewList } from "./AiGenerateReviewList";
import { AiGenerateStyleModal } from "./AiGenerateStyleModal";
import { AiGenerateTitlebar } from "./AiGenerateTitlebar";
import type { AiGenerateDraft, AiGenerateMode, GeneratedCardCandidate } from "./types";

type AiGenerateScreenProps = {
  backLabel: string;
  initialSpaceId?: string | null;
  onBack: () => void;
  onCreateSpace: (name: string) => Promise<SpaceSummary>;
  onOpenSettings: () => void;
  onSaveApprovedCards: (input: {
    cards: Array<{ back: string; front: string; tags: string[] }>;
    spaceId: string;
  }) => Promise<void>;
  spaces: SpaceSummary[];
};

const DEFAULT_AI_SETTINGS: AiSettings = {
  apiKey: "",
  hasApiKey: false,
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-5.4",
  maxTokens: "4096",
  temperature: "0.7",
};

export function AiGenerateScreen({
  backLabel,
  initialSpaceId = null,
  onBack,
  onCreateSpace,
  onOpenSettings,
  onSaveApprovedCards,
  spaces,
}: AiGenerateScreenProps) {
  const [aiSettings, setAiSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [mode, setMode] = useState<AiGenerateMode>("form");
  const [draft, setDraft] = useState<AiGenerateDraft>(() =>
    createInitialDraft(spaces, initialSpaceId),
  );
  const [styleModalOpen, setStyleModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string>("No generation attempt yet.");
  const [generatedCards, setGeneratedCards] = useState<GeneratedCardCandidate[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [regeneratingCardId, setRegeneratingCardId] = useState<string | null>(null);

  const targetSpaceName = getTargetSpaceName(draft, spaces);
  const endpointHost = getEndpointHost(aiSettings.baseUrl);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const settings = await loadAiSettings();

        if (cancelled) {
          return;
        }

        setAiSettings(settings);
        setMode(hasConfiguredAiKey(settings) ? "form" : "no-key");
      } catch (error: unknown) {
        if (!cancelled) {
          setRuntimeError(error instanceof Error ? error.message : "Failed to load AI settings.");
          setMode("error");
        }
      } finally {
        if (!cancelled) {
          setIsSettingsLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (spaces.length === 0 && draft.spaceId !== NEW_SPACE_OPTION_ID) {
      setDraft((currentDraft) => ({ ...currentDraft, spaceId: NEW_SPACE_OPTION_ID }));
      return;
    }

    if (
      draft.spaceId !== NEW_SPACE_OPTION_ID &&
      draft.spaceId &&
      spaces.some((space) => space.id === draft.spaceId)
    ) {
      return;
    }

    if (initialSpaceId && spaces.some((space) => space.id === initialSpaceId)) {
      setDraft((currentDraft) => ({ ...currentDraft, spaceId: initialSpaceId }));
      return;
    }

    if (spaces[0]) {
      setDraft((currentDraft) => ({ ...currentDraft, spaceId: spaces[0].id }));
    }
  }, [draft.spaceId, initialSpaceId, spaces]);

  function handleDraftChange(patch: Partial<AiGenerateDraft>) {
    setFormError(null);
    setDraft((currentDraft) => ({ ...currentDraft, ...patch }));
  }

  async function handleGenerate() {
    const normalizedTopic = draft.topic.trim();

    if (!normalizedTopic) {
      setFormError("Add a topic first.");
      return;
    }

    if (draft.spaceId === NEW_SPACE_OPTION_ID && !draft.newSpaceName.trim()) {
      setFormError("Name the new space first.");
      return;
    }

    setFormError(null);
    setMode("loading");

    try {
      const cards = await generateAiCards({
        count: draft.autoCount ? null : draft.count,
        difficulty: draft.difficulty,
        style: draft.style,
        topic: normalizedTopic,
      });
      setGeneratedCards(
        cards.map((card, index) => ({
          ...card,
          id: `ai-card-${Date.now()}-${index}`,
          status: "pending",
          tags: buildGeneratedTags(draft, index, card.front),
        })),
      );
      setMode("review");
    } catch (error: unknown) {
      setRuntimeError(error instanceof Error ? error.message : "Generation failed.");
      setMode("error");
    }
  }

  function handleRetryGeneration() {
    setMode("form");
    void handleGenerate();
  }

  function handleApprove(cardId: string) {
    setGeneratedCards((currentCards) =>
      currentCards.map((card) => (card.id === cardId ? { ...card, status: "approved" } : card)),
    );
  }

  function handleDiscard(cardId: string) {
    setGeneratedCards((currentCards) =>
      currentCards.map((card) => (card.id === cardId ? { ...card, status: "discarded" } : card)),
    );
  }

  async function handleRegenerate(cardId: string) {
    setRegeneratingCardId(cardId);

    try {
      const [replacement] = await generateAiCards({
        count: 1,
        difficulty: draft.difficulty,
        style: draft.style,
        topic: draft.topic.trim(),
      });

      if (!replacement) {
        throw new Error("The provider did not return a replacement card.");
      }

      setGeneratedCards((currentCards) =>
        currentCards.map((card, index) =>
          card.id === cardId
            ? {
                ...replacement,
                id: card.id,
                status: "pending",
                tags: buildGeneratedTags(draft, index, replacement.front),
              }
            : card,
        ),
      );
    } catch (error: unknown) {
      setRuntimeError(error instanceof Error ? error.message : "Regeneration failed.");
      setMode("error");
    } finally {
      setRegeneratingCardId(null);
    }
  }

  function handleBulkApprove() {
    setGeneratedCards((currentCards) =>
      currentCards.map((card) =>
        card.status === "discarded" ? card : { ...card, status: "approved" },
      ),
    );
  }

  function handleBulkDiscard() {
    setGeneratedCards((currentCards) =>
      currentCards.map((card) => ({ ...card, status: "discarded" })),
    );
  }

  async function handleSave() {
    const approvedCards = generatedCards
      .filter((card) => card.status === "approved")
      .map(({ back, front, tags }) => ({ back, front, tags }));

    if (approvedCards.length === 0) {
      return;
    }

    setIsSaving(true);

    try {
      let targetSpaceId = draft.spaceId;

      if (targetSpaceId === NEW_SPACE_OPTION_ID) {
        const createdSpace = await onCreateSpace(draft.newSpaceName);
        targetSpaceId = createdSpace.id;
      }

      await onSaveApprovedCards({ cards: approvedCards, spaceId: targetSpaceId });
    } catch (error: unknown) {
      setRuntimeError(error instanceof Error ? error.message : "Saving generated cards failed.");
      setMode("error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <AiGenerateTitlebar backLabel={backLabel} onBack={onBack} />

      <div className={`page ${styles.aiGenPage}`}>
        {isSettingsLoading ? (
          <AiGenerateLoading model="AI provider" topic="Loading saved settings" />
        ) : mode === "no-key" ? (
          <AiGenerateNoKey onOpenSettings={onOpenSettings} />
        ) : mode === "loading" ? (
          <AiGenerateLoading model={aiSettings.model} topic={draft.topic} />
        ) : mode === "error" ? (
          <AiGenerateError
            detail={runtimeError}
            onEditPrompt={() => setMode("form")}
            onRetry={handleRetryGeneration}
          />
        ) : mode === "review" ? (
          <AiGenerateReviewList
            cards={generatedCards}
            isRegenerating={regeneratingCardId}
            isSaving={isSaving}
            onApprove={handleApprove}
            onBulkApprove={handleBulkApprove}
            onBulkDiscard={handleBulkDiscard}
            onDiscard={handleDiscard}
            onRegenerate={(cardId) => void handleRegenerate(cardId)}
            onSave={() => void handleSave()}
            targetSpaceName={targetSpaceName}
          />
        ) : (
          <AiGenerateForm
            draft={draft}
            endpointHost={endpointHost}
            error={formError}
            model={aiSettings.model}
            onChange={handleDraftChange}
            onGenerate={() => void handleGenerate()}
            onOpenSettings={onOpenSettings}
            onOpenStyleModal={() => setStyleModalOpen(true)}
            spaces={spaces}
          />
        )}

        <div className="page-end" />
      </div>

      <AiGenerateStyleModal isOpen={styleModalOpen} onClose={() => setStyleModalOpen(false)} />
    </>
  );
}

function createInitialDraft(
  spaces: SpaceSummary[],
  initialSpaceId: string | null,
): AiGenerateDraft {
  const nextSpaceId =
    initialSpaceId && spaces.some((space) => space.id === initialSpaceId)
      ? initialSpaceId
      : (spaces[0]?.id ?? NEW_SPACE_OPTION_ID);

  return {
    autoCount: false,
    count: 10,
    difficulty: "Intermediate",
    newSpaceName: "",
    spaceId: nextSpaceId,
    style: "Q&A",
    topic: "",
  };
}

function getTargetSpaceName(draft: AiGenerateDraft, spaces: SpaceSummary[]) {
  if (draft.spaceId === NEW_SPACE_OPTION_ID) {
    return draft.newSpaceName.trim() || "New space";
  }

  return spaces.find((space) => space.id === draft.spaceId)?.name ?? "selected space";
}

function getEndpointHost(baseUrl: string) {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl.replace(/^https?:\/\//, "");
  }
}

function buildGeneratedTags(draft: AiGenerateDraft, index: number, front: string) {
  const concepts = extractConcepts(draft.topic.trim());
  const fallbackConcept = concepts[index % concepts.length] ?? front;

  return [
    "ai",
    normalizeTag(draft.style),
    normalizeTag(draft.difficulty),
    normalizeTag(fallbackConcept),
  ];
}

function extractConcepts(topic: string) {
  const rawParts = topic
    .split(/[\n,;]+|\s+[/-]\s+|\s+—\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const baseParts = rawParts.length > 0 ? rawParts : [topic];
  const normalized = Array.from(
    new Set(
      baseParts
        .flatMap((part) => splitLongPart(part))
        .map((part) => cleanupConcept(part))
        .filter((part) => part.length > 0),
    ),
  );

  return normalized.length > 0 ? normalized : [topic];
}

function splitLongPart(part: string) {
  if (part.split(" ").length <= 5) {
    return [part];
  }

  return [
    part,
    ...part
      .split(/\s+/)
      .filter((word) => word.length > 4)
      .slice(0, 3),
  ];
}

function cleanupConcept(value: string) {
  return value.replace(/[.?!]+$/, "").trim();
}

function normalizeTag(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
