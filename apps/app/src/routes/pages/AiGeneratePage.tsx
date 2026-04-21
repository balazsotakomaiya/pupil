import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { AiGenerateScreen } from "../../components/ai-generate";
import { ScreenErrorBoundary } from "../../components/ErrorBoundary";
import { useSpacesQuery } from "../../lib/app-queries";
import { createCard } from "../../lib/cards";
import { notifySuccess } from "../../lib/notifications";
import { appQueryKeys, invalidateAllAppData } from "../../lib/query";
import { createSpace } from "../../lib/spaces";
import { SettingsPage } from "./SettingsPage";

function AiGeneratePage({ targetSpaceId }: { targetSpaceId?: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const spaces = useSpacesQuery().data ?? [];
  const targetSpace = targetSpaceId
    ? (spaces.find((space) => space.id === targetSpaceId) ?? null)
    : null;
  const [showSettings, setShowSettings] = useState(false);
  const createSpaceMutation = useMutation({
    mutationFn: async (name: string) => createSpace({ name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: appQueryKeys.spaces });
    },
  });
  const saveApprovedMutation = useMutation({
    mutationFn: async (input: {
      cards: Array<{ back: string; front: string; tags: string[] }>;
      spaceId: string;
    }) => {
      await Promise.all(
        input.cards.map((card) =>
          createCard({
            ...card,
            source: "ai",
            spaceId: input.spaceId,
          }),
        ),
      );
    },
    onSuccess: async (_, variables) => {
      await invalidateAllAppData(queryClient);
      notifySuccess("AI cards saved");
      void navigate({ to: "/spaces/$spaceId", params: { spaceId: variables.spaceId } });
    },
  });

  if (showSettings) {
    return (
      <SettingsPage
        fromAi
        onBack={() => {
          setShowSettings(false);
        }}
      />
    );
  }

  return (
    <ScreenErrorBoundary
      onReset={() =>
        targetSpaceId
          ? void navigate({ to: "/spaces/$spaceId", params: { spaceId: targetSpaceId } })
          : void navigate({ to: "/" })
      }
      screen="ai-generate"
      title="AI generation unavailable"
    >
      <AiGenerateScreen
        backLabel={targetSpace?.name ?? "Dashboard"}
        initialSpaceId={targetSpaceId ?? spaces[0]?.id ?? null}
        onBack={() =>
          targetSpaceId
            ? void navigate({ to: "/spaces/$spaceId", params: { spaceId: targetSpaceId } })
            : void navigate({ to: "/" })
        }
        onCreateSpace={(name) => createSpaceMutation.mutateAsync(name)}
        onOpenSettings={() => {
          setShowSettings(true);
        }}
        onSaveApprovedCards={(input) => saveApprovedMutation.mutateAsync(input)}
        spaces={spaces}
      />
    </ScreenErrorBoundary>
  );
}

export function GlobalAiGeneratePage() {
  return <AiGeneratePage />;
}

export function SpaceAiGeneratePage() {
  const { spaceId } = useParams({ from: "/spaces/$spaceId/generate" });
  return <AiGeneratePage targetSpaceId={spaceId} />;
}
