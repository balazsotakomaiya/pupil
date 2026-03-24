import { useEffect, useMemo, useRef, useState } from "react";
import { hasConfiguredAiKey, readAiSettings } from "../../lib/ai-settings";
import type { SpaceSummary } from "../../lib/spaces";
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

export function AiGenerateScreen({
  backLabel,
  initialSpaceId = null,
  onBack,
  onCreateSpace,
  onOpenSettings,
  onSaveApprovedCards,
  spaces,
}: AiGenerateScreenProps) {
  const aiSettings = useMemo(() => readAiSettings(), []);
  const [mode, setMode] = useState<AiGenerateMode>(
    hasConfiguredAiKey(aiSettings) ? "form" : "no-key",
  );
  const [draft, setDraft] = useState<AiGenerateDraft>(() => createInitialDraft(spaces, initialSpaceId));
  const [styleModalOpen, setStyleModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string>("No generation attempt yet.");
  const [generatedCards, setGeneratedCards] = useState<GeneratedCardCandidate[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const loadingTimeoutRef = useRef<number | null>(null);

  const targetSpaceName = getTargetSpaceName(draft, spaces);
  const endpointHost = getEndpointHost(aiSettings.baseUrl);

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

  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current !== null) {
        window.clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  function handleDraftChange(patch: Partial<AiGenerateDraft>) {
    setFormError(null);
    setDraft((currentDraft) => ({ ...currentDraft, ...patch }));
  }

  function handleGenerate() {
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

    if (loadingTimeoutRef.current !== null) {
      window.clearTimeout(loadingTimeoutRef.current);
    }

    loadingTimeoutRef.current = window.setTimeout(() => {
      try {
        const nextCards = buildGeneratedCards(draft);
        setGeneratedCards(nextCards);
        setMode("review");
      } catch (error: unknown) {
        setRuntimeError(error instanceof Error ? error.message : "Generation failed.");
        setMode("error");
      }
    }, 900);
  }

  function handleRetryGeneration() {
    setMode("form");
    handleGenerate();
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

  function handleRegenerate(cardId: string) {
    setGeneratedCards((currentCards) =>
      currentCards.map((card, index) =>
        card.id === cardId
          ? {
              ...buildGeneratedCard(draft, index, index + 1),
              id: card.id,
              status: "pending",
            }
          : card,
      ),
    );
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

      <div className="page ai-gen-page">
        {mode === "no-key" ? (
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
            isSaving={isSaving}
            onApprove={handleApprove}
            onBulkApprove={handleBulkApprove}
            onBulkDiscard={handleBulkDiscard}
            onDiscard={handleDiscard}
            onRegenerate={handleRegenerate}
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
            onGenerate={handleGenerate}
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

function createInitialDraft(spaces: SpaceSummary[], initialSpaceId: string | null): AiGenerateDraft {
  const nextSpaceId =
    initialSpaceId && spaces.some((space) => space.id === initialSpaceId)
      ? initialSpaceId
      : spaces[0]?.id ?? NEW_SPACE_OPTION_ID;

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

function buildGeneratedCards(draft: AiGenerateDraft): GeneratedCardCandidate[] {
  const topic = draft.topic.trim();
  const count = draft.autoCount ? estimateAutoCount(topic) : draft.count;

  return Array.from({ length: count }, (_, index) => ({
    ...buildGeneratedCard(draft, index, 0),
    id: `ai-card-${index}`,
    status: "pending",
  }));
}

function buildGeneratedCard(
  draft: AiGenerateDraft,
  index: number,
  variantOffset: number,
): Omit<GeneratedCardCandidate, "id" | "status"> {
  const topic = draft.topic.trim();
  const concepts = extractConcepts(topic);
  const concept = concepts[(index + variantOffset) % concepts.length] ?? topic;
  const detail = concepts[(index + variantOffset + 1) % concepts.length] ?? topic;
  const tags = [
    "ai",
    normalizeTag(draft.style),
    normalizeTag(draft.difficulty),
    normalizeTag(concept),
  ];

  if (draft.style === "Concept") {
    return {
      back: `${concept} is a core idea in ${topic}. ${difficultyExplanation(
        draft.difficulty,
      )} Focus on how it connects to ${detail.toLowerCase()}.`,
      front: concept,
      tags,
    };
  }

  if (draft.style === "Cloze") {
    return {
      back: `${concept}. In ${topic}, it matters because it anchors ${detail.toLowerCase()}. ${difficultyExplanation(
        draft.difficulty,
      )}`,
      front: `In ${topic}, _____ is closely tied to ${detail.toLowerCase()}.`,
      tags,
    };
  }

  const promptStyles = [
    `What is ${concept}?`,
    `Why does ${concept} matter in ${topic}?`,
    `How would you explain ${concept} in one clean sentence?`,
    `What role does ${concept} play relative to ${detail.toLowerCase()}?`,
  ];

  return {
    back: `${concept} is a key part of ${topic}. ${difficultyExplanation(
      draft.difficulty,
    )} It is especially useful to connect it with ${detail.toLowerCase()}.`,
    front: promptStyles[(index + variantOffset) % promptStyles.length],
    tags,
  };
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

function difficultyExplanation(difficulty: string) {
  switch (difficulty) {
    case "Beginner":
      return "Keep the explanation grounded and plain, with minimal jargon.";
    case "Advanced":
      return "Include the deeper mechanism, tradeoff, or edge case that makes it matter.";
    default:
      return "Aim for a precise explanation that still stays compact enough to review quickly.";
  }
}

function estimateAutoCount(topic: string) {
  const conceptCount = extractConcepts(topic).length;
  return Math.max(6, Math.min(18, conceptCount * 2));
}

function normalizeTag(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
